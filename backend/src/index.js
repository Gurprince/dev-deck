// backend/src/index.js
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { createServer } from "node:http";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import User from "./models/User.js";
import Message from "./models/Message.js";
import jwt from "jsonwebtoken";
import { connectDB } from "./config/db.js";
import Project from "./models/Project.js";
import errorHandler from "./middleware/errorHandler.js";
import projectRoutes from "./routes/projectRoutes.js";
import sseRoutes from "./routes/sseRoutes.js";
import authRoutes from "./routes/auth.js";
import apiRoutes from "./routes/api.js";
import usersRoutes from "./routes/users.js";
import swaggerDocs from "./config/swagger.js";

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

// API Documentation
swaggerDocs(app);

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
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "authorization"],
    credentials: true,
  },
  path: "/socket.io/",
  serveClient: false,
  allowEIO3: true,
  connectTimeout: 45000,
});

// Make io available to other modules
app.set('io', io);

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    // Try to get token from auth, query, or headers
    const token = socket.handshake.auth?.token ||
                 socket.handshake.query?.token ||
                 (socket.handshake.headers.authorization || '').split(' ')[1];

    if (!token) {
      console.log('No token provided for WebSocket connection');
      return next(new Error('Authentication error: No token provided'));
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Ensure we have a valid user ID
    if (!decoded.userId) {
      console.log('WebSocket auth error: No userId in token');
      return next(new Error('Authentication error: Invalid token format'));
    }
    
    try {
      // Fetch the complete user document from the database
      const user = await User.findById(decoded.userId).select('name email username').lean();
      
      if (!user) {
        console.log('User not found in database');
        return next(new Error('Authentication error: User not found'));
      }
      
      // Attach complete user data to the socket
      socket.user = {
        userId: user._id.toString(),
        email: user.email || '',
        name: user.name || user.username || 'Anonymous',
        username: user.username || user.email?.split('@')[0] || 'user'
      };
      
      console.log('WebSocket authenticated user:', {
        userId: socket.user.userId,
        name: socket.user.name,
        email: socket.user.email
      });
      
      console.log(`User authenticated via WebSocket:`, {
        userId: socket.user.userId,
        name: socket.user.name,
        email: socket.user.email,
        socketId: socket.id
      });
      
      console.log(`User authenticated via WebSocket: ${socket.user.userId} (${socket.user.name || socket.user.email})`);
      next();
    } catch (dbError) {
      console.error('Database error during WebSocket auth:', dbError);
      return next(new Error('Authentication error: Could not fetch user data'));
    }
  } catch (error) {
    console.error('WebSocket authentication error:', error);
    const errorMessage = error.name === 'TokenExpiredError' 
      ? 'Authentication error: Token expired' 
      : 'Authentication error: Invalid token';
    return next(new Error(errorMessage));
  }
});

// In-memory collaborators per project (do not persist to DB)
const collaboratorsByProject = new Map();

// Helper to get or create project collaborators list
const getOrCreateProjectCollaborators = (projectId) => {
  if (!collaboratorsByProject.has(projectId)) {
    collaboratorsByProject.set(projectId, []);
  }
  return collaboratorsByProject.get(projectId);
};

// Socket.IO for real-time collaboration
io.on("connection", (socket) => {
  console.log("User connected:", socket.id, "User ID:", socket.user?.userId || 'unknown');

  // Handle project room joining
  const handleJoinProject = (data) => {
    if (!data) {
      console.error('No data provided for joinProject');
      return;
    }

    // Ensure projectId is a valid string
    const projectId = data.projectId || data.room;
    const { userId, username } = data;
    
    if (!projectId) {
      console.error('No projectId provided for join');
      return;
    }
    
    const projectIdStr = String(projectId);
    
    // Basic validation for MongoDB ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(projectIdStr)) {
      console.error(`Invalid project ID format: ${projectIdStr}`);
      return;
    }
    
    console.log(`User ${socket.user?.userId || 'unknown'} attempting to join project ${projectIdStr}`);
    
    // Verify user has access to the project
    Project.findById(projectIdStr)
      .then(project => {
        if (!project) {
          console.error(`Project ${projectIdStr} not found`);
          return;
        }
        
        // Check if user is the owner or a collaborator
        const isOwner = project.owner.toString() === socket.user?.userId;
        const isCollaborator = project.collaborators.some(
          collab => collab.user.toString() === socket.user?.userId
        );
        
        if (!isOwner && !isCollaborator && !project.isPublic) {
          console.error(`User ${socket.user?.userId} is not authorized to join project ${projectId}`);
          return;
        }
        
        // Join the room
        socket.join(projectIdStr);
        console.log(`User ${socket.user?.userId || 'unknown'} joined project ${projectIdStr}`);
        
        // Add to collaborators list
        const userDisplayName = username || 
                              socket.user?.name || 
                              socket.user?.username || 
                              'Anonymous';
                              
        // Ensure we don't append @dev-deck.local to an existing email
        let userEmail = socket.user?.email || '';
        if (!userEmail) {
          // Only create a dev-deck email if no email exists and the username looks like an email
          const isEmailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userDisplayName);
          userEmail = isEmailLike ? userDisplayName : `${userDisplayName.replace(/\s+/g, '.').toLowerCase()}@dev-deck.local`;
        }
        
        const userId = socket.user?.userId || `user-${Date.now()}`;
        
        const collaborators = getOrCreateProjectCollaborators(projectIdStr);
        const existingUserIndex = collaborators.findIndex(u => u.userId === userId);
        
        const userData = {
          userId: userId,
          username: userDisplayName,
          email: userEmail,
          socketId: socket.id,
          joinedAt: new Date(),
          status: 'online',
          color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`
        };
        
        if (existingUserIndex >= 0) {
          // Update existing user
          collaborators[existingUserIndex] = { ...collaborators[existingUserIndex], ...userData };
        } else {
          // Add new user
          collaborators.push(userData);
          
          // Notify others about the new collaborator
          socket.to(projectId).emit('collaborator-joined', {
            userId: socket.user?.userId,
            username: userDisplayName,
            email: userEmail
          });
        }
        
        // Send updated collaborator list to all clients in the room
        io.to(projectId).emit('collaborator-update', [...collaborators]);
      })
      .catch(error => {
        console.error('Error joining project room:', error);
      });
  };
  
  // Handle project room leaving
  const handleLeaveProject = (data) => {
    if (!data) return;
    
    // Ensure projectId is a string
    const projectId = String(data.projectId || data.room);
    if (!projectId) return;
    
    console.log(`User ${socket.user?.userId} leaving project ${projectId}`);
    
    // Leave the room
    socket.leave(projectId);
    
    // Remove from collaborators list if this is their last connection
    if (socket.user?.userId) {
      const collaborators = getOrCreateProjectCollaborators(projectId);
      const userIndex = collaborators.findIndex(u => u.userId === socket.user.userId);
      
      if (userIndex >= 0) {
        // Check if this is the user's last connection to this project
        const userConnections = collaborators.filter(u => u.userId === socket.user.userId);
        
        if (userConnections.length <= 1) {
          // This is the last connection for this user to this project
          const updatedList = collaborators.filter(u => u.userId !== socket.user.userId);
          collaboratorsByProject.set(projectId, updatedList);
          
          // Notify others about the collaborator leaving
          socket.to(projectId).emit('collaborator-left', {
            userId: socket.user.userId
          });
          
          // Send updated collaborator list to all clients in the room
          io.to(projectId).emit('collaborator-update', [...updatedList]);
        } else {
          // User has other connections, just remove this one
          const updatedList = collaborators.filter(u => u.socketId !== socket.id);
          collaboratorsByProject.set(projectId, updatedList);
        }
      }
    }
  };

  // Support both event name styles
  socket.on("join-project", handleJoinProject);
  socket.on("joinProject", handleJoinProject);
  socket.on("leave-project", handleLeaveProject);
  socket.on("leaveProject", handleLeaveProject);
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id, 'User ID:', socket.user?.userId || 'unknown');
    
    // Clean up from all project rooms
    collaboratorsByProject.forEach((users, projectId) => {
      const updatedUsers = users.filter(u => u.socketId !== socket.id);
      if (updatedUsers.length !== users.length) {
        collaboratorsByProject.set(projectId, updatedUsers);
        
        // Notify remaining users in the room
        io.to(projectId).emit('collaborator-update', [...updatedUsers]);
      }
    });
  });
  
  // Handle chat messages
  socket.on('chatMessage', async (data) => {
    if (!data.projectId || !data.text) return;
    
    try {
      // Ensure projectId is a string
      const projectId = String(data.projectId);
      
      // Get user info from the socket (already authenticated)
      if (!socket.user?.userId) {
        console.error('No user ID found in socket.user');
        return;
      }
      
      // Fetch the latest user data from the database to ensure we have the most up-to-date information
      let user;
      try {
        user = await User.findById(socket.user.userId).select('name email username').lean();
        if (!user) {
          console.error('User not found in database');
          return;
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        return;
      }
      
      // Prepare sender info with proper fallbacks
      const senderInfo = {
        _id: user._id.toString(),
        name: user.name || user.username || 'User',
        username: user.username || user.email?.split('@')[0] || 'user',
        email: user.email || ''
      };
      
      // Log the user data for debugging
      console.log('User data from database:', {
        name: user.name,
        username: user.username,
        email: user.email,
        _id: user._id
      });
      
      console.log('Prepared sender info:', senderInfo);
      
      console.log('Sending message with sender info:', senderInfo);
      
      // Create and save the message
      const message = new Message({
        _id: data._id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: data.text,
        project: projectId,
        sender: user._id, // Use the user ID from the fetched user data
        senderInfo: senderInfo,
        createdAt: new Date()
      });
      
      await message.save();
      
      // Prepare the complete message object for broadcasting
      // Use the senderInfo we already have to ensure consistency
      const completeMessage = {
        _id: message._id.toString(),
        text: message.text,
        project: projectId,
        projectId: projectId,
        createdAt: message.createdAt,
        timestamp: message.createdAt ? new Date(message.createdAt).getTime() : Date.now(),
        
        // Sender information - use the senderInfo we prepared earlier
        sender: {
          _id: senderInfo._id,
          name: senderInfo.name,
          username: senderInfo.username,
          email: senderInfo.email
        },
        
        // For backward compatibility
        senderId: senderInfo._id,
        senderName: senderInfo.name,
        senderEmail: senderInfo.email
      };
      
      // Log the complete message before broadcasting
      console.log('Broadcasting message with sender info:', {
        messageId: completeMessage._id,
        sender: completeMessage.sender,
        projectId: projectId,
        text: completeMessage.text.substring(0, 50) + (completeMessage.text.length > 50 ? '...' : '')
      });
      
      try {
        // Broadcast to all clients in the project room (including the sender)
        io.to(projectId).emit('chatMessage', completeMessage);
        
        console.log(`Message broadcast to room ${projectId}`);
        
        // Log the message for debugging
        console.log('Message sent to room:', {
          projectId: projectId,
          messageId: completeMessage._id,
          senderId: completeMessage.sender._id,
          senderName: completeMessage.sender.name,
          senderEmail: completeMessage.sender.email,
          text: completeMessage.text.substring(0, 50) + (completeMessage.text.length > 50 ? '...' : '')
        });
      } catch (error) {
        console.error('Error broadcasting message:', error);
      }
    } catch (error) {
      console.error('Error in chatMessage handler:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Clean up from all project rooms
    collaboratorsByProject.forEach((users, projectId) => {
      const updatedUsers = users.filter(u => u.socketId !== socket.id);
      if (updatedUsers.length !== users.length) {
        collaboratorsByProject.set(projectId, updatedUsers);
        // Notify remaining users in the room
        io.to(projectId).emit('collaborator-update', updatedUsers);
      }
    });
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