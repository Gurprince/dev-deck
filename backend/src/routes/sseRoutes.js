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

  // Send collaborator updates every 5 seconds (mock data without DB writes)
  const interval = setInterval(() => {
    const collaborators = [
      { userId: "1", name: "Dev1", status: "online" },
      { userId: "2", name: "Dev2", status: Math.random() > 0.5 ? "online" : "offline" },
    ];
    sendEvent(collaborators, "collaborator-update");
  }, 5000);

  // Handle client disconnect
  req.on("close", () => {
    clearInterval(interval);
    res.end();
  });
});

export default router;
