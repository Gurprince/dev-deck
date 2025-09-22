// backend/src/routes/sseRoutes.js
import express from "express";
import { logger } from "../sandbox/logger.js";
import Project from "../models/Project.js";

const router = express.Router();

router.get("/events/:projectId", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable buffering for nginx (if used)

  const projectId = req.params.projectId;

  // Verify project exists
  try {
    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404).write("event: error\ndata: Project not found\n\n");
      res.end();
      return;
    }
  } catch (error) {
    res.status(500).write("event: error\ndata: Server error\n\n");
    res.end();
    return;
  }

  // Keep connection alive
  res.write(": keep-alive\n\n");

  const sendEvent = (data, event = "message") => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial logs
  sendEvent(logger.getLogs(), "logs");

  // Track last sent collaborators to avoid sending duplicate updates
  let lastCollaborators = [];
  
  // Function to generate a consistent color from a string
  const stringToColor = (str) => {
    let hash = 0;
    for (let i = 0; i < (str || '').length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  };

  // Function to get and format collaborators data
  const getCollaboratorsData = async (targetProjectId = projectId) => {
    try {
      const project = await Project.findById(targetProjectId)
        .populate('collaborators.user', 'name email')
        .populate('owner', 'name email');
      
      if (!project) return [];
      
      // Format collaborators data
      const collaborators = [];
      const seenUserIds = new Set();
      
      // Add owner as a collaborator with admin role
      if (project.owner) {
        const ownerId = project.owner._id.toString();
        collaborators.push({
          userId: ownerId,
          name: project.owner.name || 'Project Owner',
          email: project.owner.email,
          role: 'owner',
          status: 'online',
          avatarText: project.owner.name ? project.owner.name.charAt(0).toUpperCase() : 'U',
          color: stringToColor(ownerId)
        });
        seenUserIds.add(ownerId);
      }
      
      // Add other collaborators
      for (const collab of project.collaborators) {
        if (!collab.user) continue;
        
        const userId = collab.user._id.toString();
        if (seenUserIds.has(userId) || userId === project.owner?._id?.toString()) continue;
        
        const name = collab.user.name || `User ${userId.slice(-4)}`;
        collaborators.push({
          userId,
          name,
          email: collab.user.email,
          role: collab.role || 'editor',
          status: 'online',
          avatarText: name.charAt(0).toUpperCase(),
          color: stringToColor(userId)
        });
        
        seenUserIds.add(userId);
      }
      
      return collaborators;
    } catch (error) {
      console.error('Error getting collaborators:', error);
      return [];
    }
  };
  
  // Function to send collaborator updates
  const sendCollaboratorUpdate = async () => {
    const collaborators = await getCollaboratorsData();
    
    // Only send update if collaborators have changed
    if (JSON.stringify(collaborators) !== JSON.stringify(lastCollaborators)) {
      lastCollaborators = collaborators;
      sendEvent(collaborators, 'collaborator-update');
    }
  };
  
  // Handle get-collaborators event
  const onGetCollaborators = async (targetProjectId) => {
    try {
      console.log('Received get-collaborators for project:', targetProjectId || projectId);
      const collaborators = await getCollaboratorsData(targetProjectId || projectId);
      sendEvent(collaborators, 'collaborator-update');
    } catch (error) {
      console.error('Error in onGetCollaborators:', error);
      sendEvent([], 'collaborator-update');
    }
  };
  
  // Listen for get-collaborators event
  req.socket.on('get-collaborators', onGetCollaborators);
  
  // Send initial collaborator data
  await sendCollaboratorUpdate();
  
  // Set up periodic updates (every 30 seconds)
  const interval = setInterval(sendCollaboratorUpdate, 30000);

  // Handle client disconnect
  req.on("close", () => {
    clearInterval(interval);
    if (req.socket) {
      req.socket.off('get-collaborators', onGetCollaborators);
    }
    res.end();
  });
});

export default router;
