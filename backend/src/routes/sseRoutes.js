// backend/src/routes/sseRoutes.js
import express from "express";
import jwt from 'jsonwebtoken';
import { logger } from "../sandbox/logger.js";
import Project from "../models/Project.js";
import Message from "../models/Message.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Store active connections for SSE
const activeConnections = new Map();

// Middleware to authenticate WebSocket and SSE connections
const authenticateConnection = (req, res, next) => {
  try {
    // Try to get token from query params, headers, or handshake auth
    const token = req.query?.token || 
                 (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null) ||
                 (req.handshake?.auth?.token || null);
    
    if (!token) {
      console.log('No token provided for authentication');
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded.userId) {
      console.log('Invalid token: missing userId');
      return res.status(403).json({ message: 'Invalid token format' });
    }
    
    // Attach user to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    const status = error.name === 'TokenExpiredError' ? 401 : 403;
    return res.status(status).json({ 
      message: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token',
      error: error.message 
    });
  }
};

// Helper function to broadcast messages to all connected clients
const broadcastToProject = (projectId, event, data, io = null) => {
  const connections = activeConnections.get(projectId);
  
  // For WebSocket connections - use provided io instance or global.io
  const socketIo = io || global.io;
  if (socketIo) {
    try {
      socketIo.to(projectId).emit(event, data);
    } catch (error) {
      console.error('Error broadcasting to WebSocket:', error);
    }
  } else {
    console.warn('WebSocket io instance not available for broadcasting');
  }
  
  // For SSE connections
  if (connections && connections.size > 0) {
    const sseMessage = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    
    for (const { res } of connections) {
      try {
        if (res && !res.writableEnded) {
          res.write(sseMessage);
        }
      } catch (error) {
        console.error('Error broadcasting message to SSE client:', error);
        // Remove broken connection
        const updatedConnections = new Set(connections);
        updatedConnections.delete({ res });
        activeConnections.set(projectId, updatedConnections);
      }
    }
  } else {
    console.log(`No active SSE connections for project ${projectId}`);
  }
};

// Chat routes
router.post('/chat/:projectId', authenticateConnection, async (req, res) => {
  try {
    const { text, sender } = req.body;
    const projectId = req.params.projectId;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    // Create a new message
    const message = new Message({
      text: text.trim(),
      project: projectId,
      sender: {
        _id: req.user.userId,
        name: req.user.name,
        email: req.user.email
      },
      isSystem: false
    });

    // Save the message to the database
    await message.save();

    // Broadcast the message to all connected clients
    broadcastToProject(projectId, 'chat-message', message);

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending chat message:', error);
    res.status(500).json({ message: 'Failed to send message', error: error.message });
  }
});

// Get chat history
router.get('/chat/:projectId', authenticateConnection, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    
    // Verify user has access to the project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user is a collaborator or the project is public
    const isCollaborator = project.collaborators.some(
      collab => collab.user && collab.user.toString() === req.user.userId
    );
    
    if (project.owner.toString() !== req.user.userId && !isCollaborator && !project.isPublic) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Fetch messages with proper projection
    const messages = await Message.find(
      { project: projectId },
      { 
        'text': 1,
        'sender': 1,
        'createdAt': 1,
        '_id': 1
      }
    )
    .sort({ createdAt: 1 })
    .limit(100)
    .lean(); // Convert to plain JavaScript objects
    
    // Ensure consistent message format
    const formattedMessages = messages.map(msg => ({
      ...msg,
      _id: msg._id.toString(),
      project: projectId,
      sender: {
        _id: msg.sender._id?.toString() || req.user.userId,
        name: msg.sender.name || 'Anonymous',
        email: msg.sender.email || ''
      }
    }));
    
    res.json(formattedMessages);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ 
      message: 'Error fetching chat history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Handle chat messages
router.post('/sse/chat/:projectId', authenticateConnection, async (req, res) => {
  try {
    const { text } = req.body;
    const projectId = req.params.projectId;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message text is required' });
    }
    
    // Verify project exists and user has access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user is a collaborator or the project is public
    const isCollaborator = project.collaborators.some(
      collab => collab.user && collab.user.toString() === req.user.userId
    );
    
    if (project.owner.toString() !== req.user.userId && !isCollaborator && !project.isPublic) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get sender information with fallbacks
    const senderName = req.user.name || req.user.username || 'Anonymous';
    // Generate a default email if not provided, using the pattern username@project-id.dev-deck.local
    const senderEmail = req.user.email || 
                      `${req.user.username || 'user'}-${Date.now().toString(36)}@project-${projectId}.dev-deck.local`;

    // Create and save the message
    const message = new Message({
      text: text.trim(),
      project: projectId,
      sender: {
        _id: req.user.userId,
        name: senderName,
        email: senderEmail
      },
      createdAt: new Date()
    });

    await message.save();
    
    // Broadcast the new message to all connected clients
    const messageForClients = message.toObject();
    messageForClients._id = message._id.toString();
    
    // Ensure the message has all required fields
    const broadcastMessage = {
      ...messageForClients,
      sender: {
        _id: req.user.userId,
        name: senderName,
        email: senderEmail
      },
      project: projectId,
      createdAt: message.createdAt
    };
    
    // Broadcast to both WebSocket and SSE clients
    const io = req.app.get('io');
    if (io) {
      io.to(projectId).emit('chatMessage', broadcastMessage);
    }
    broadcastToProject(projectId, 'chatMessage', broadcastMessage);

    res.status(201).json(broadcastMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ 
      message: 'Error sending message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// SSE endpoint for real-time updates
router.get("/sse/events/:projectId", authenticateConnection, async (req, res) => {
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

  // Store the connection
  if (!activeConnections.has(projectId)) {
    activeConnections.set(projectId, new Set());
  }
  
  const connectionId = Date.now().toString();
  const connection = { id: connectionId, res, userId: req.user?.userId };
  activeConnections.get(projectId).add(connection);

  // Send initial connection confirmation
  try {
    res.write(`event: connection\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`);
  } catch (error) {
    console.error('Error sending connection confirmation:', error);
  }

  // Remove connection when client disconnects
  const cleanup = () => {
    const connections = activeConnections.get(projectId);
    if (connections) {
      for (const conn of connections) {
        if (conn.id === connectionId) {
          connections.delete(conn);
          break;
        }
      }
      if (connections.size === 0) {
        activeConnections.delete(projectId);
      }
    }
  };

  req.on('close', cleanup);
  req.on('error', cleanup);

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

// Clear chat history for a project
router.delete('/chat/:projectId', authenticateConnection, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.userId;

    // Verify project exists and user has permission
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user is the owner or a collaborator with delete permissions
    const isOwner = project.owner.toString() === userId;
    const isCollaborator = project.collaborators.some(
      collab => collab.user && collab.user.toString() === userId
    );

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: 'Not authorized to clear chat history' });
    }

    // Delete all messages for this project
    await Message.deleteMany({ project: projectId });

    // Broadcast to all connected clients that chat was cleared
    broadcastToProject(projectId, 'chat_cleared', { 
      projectId,
      clearedBy: userId,
      timestamp: new Date()
    });

    res.json({ 
      success: true, 
      message: 'Chat history cleared successfully',
      projectId
    });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to clear chat history',
      error: error.message 
    });
  }
});

export default router;
