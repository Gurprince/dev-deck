// backend/src/index.js
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { createServer } from "node:http";
import { connectDB } from "./config/db.js";
import Project from "./models/Project.js";
import errorHandler from "./middleware/errorHandler.js";
import projectRoutes from "./routes/projectRoutes.js";
import sseRoutes from "./routes/sseRoutes.js";
import authRoutes from "./routes/auth.js";
import apiRoutes from "./routes/api.js";
import usersRoutes from "./routes/users.js";

const app = express();
const server = createServer(app);

// CORS configuration
const whitelist = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow same-origin (no origin header) and whitelisted origins
    if (!origin || whitelist.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "authorization",
    "X-Requested-With",
    "x-requested-with",
  ],
  optionsSuccessStatus: 204,
};

// Apply CORS to all routes
app.use(cors(corsOptions));

// Explicit preflight handler compatible with Express 5 (no wildcard path)
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    const origin = req.headers.origin;
    if (!origin || whitelist.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin || "*");
      res.header("Vary", "Origin");
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      res.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, authorization, X-Requested-With, x-requested-with"
      );
      return res.sendStatus(204);
    }
  }
  next();
});

// Additionally handle OPTIONS on /api/* via regex to ensure proper headers
app.options(/^\/api\/.*$/, cors(corsOptions));

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api", sseRoutes);
app.use("/api", apiRoutes);
app.use("/api/users", usersRoutes);

// WebSocket setup
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// In-memory collaborators per project (do not persist to DB)
const collaboratorsByProject = new Map();

// Socket.IO for real-time collaboration
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  const addCollaborator = (projectId, collaborator) => {
    const list = collaboratorsByProject.get(projectId) || [];
    const without = list.filter((c) => c.userId !== collaborator.userId);
    collaboratorsByProject.set(projectId, [...without, collaborator]);
  };

  const removeCollaborator = (projectId, userId) => {
    const list = collaboratorsByProject.get(projectId) || [];
    const filtered = list.filter((c) => c.userId !== userId);
    collaboratorsByProject.set(projectId, filtered);
  };

  const emitUpdate = (projectId) => {
    io.to(projectId).emit("collaborator-update", collaboratorsByProject.get(projectId) || []);
  };

  const onJoin = (projectId, username) => {
    socket.join(projectId);
    addCollaborator(projectId, { userId: socket.id, name: username || "Anonymous", status: "online" });
    emitUpdate(projectId);
  };

  const onLeave = (projectId) => {
    socket.leave(projectId);
    removeCollaborator(projectId, socket.id);
    emitUpdate(projectId);
  };

  // Support both event name styles
  socket.on("join-project", onJoin);
  socket.on("joinProject", onJoin);

  socket.on("leave-project", onLeave);
  socket.on("leaveProject", onLeave);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Expose io to routes
app.set("io", io);

// Error handling middleware (centralized)
app.use(errorHandler);

const startServer = async () => {
  try {
    console.log("Attempting to connect to MongoDB...");
    await connectDB();
    console.log("MongoDB connected successfully");

    // Ensure indexes match the current schema (drops obsolete ones like { user, name })
    try {
      await Project.syncIndexes();
      console.log("Project indexes synchronized");
    } catch (idxErr) {
      console.error("Failed to sync Project indexes:", idxErr);
    }

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();