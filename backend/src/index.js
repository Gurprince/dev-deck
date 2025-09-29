// backend/src/index.js
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { createServer } from "node:http";
import path from "path";
import { fileURLToPath } from 'url';
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Project from "./models/Project.js";
import User from "./models/User.js";
import Message from "./models/Message.js";
import helmet from "helmet";
import compression from "compression";
import { connectDB } from "./config/db.js";
import errorHandler from "./middleware/errorHandler.js";
import projectRoutes from "./routes/projectRoutes.js";
import sseRoutes from "./routes/sseRoutes.js";
import authRoutes from "./routes/auth.js";
import apiRoutes from "./routes/api.js";
import usersRoutes from "./routes/users.js";
import swaggerDocs from "./config/swagger.js";
import { rateLimit as customRateLimit } from './middleware/rateLimit.js';

// Initialize express app and HTTP server
const app = express();
const server = createServer(app);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security and performance middleware
app.use(helmet()); // Add security headers
app.use(compression()); // Compress responses
app.use(express.json({ limit: '10kb' })); // Limit JSON body size
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Apply custom rate limiting to the execute endpoint
app.use('/api/execute', customRateLimit);

// CORS configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://dev-deck-app.vercel.app",
  "https://dev-deck-git-main-gurprinces-projects.vercel.app",
  "https://dev-deck-1r9p1q7b2-gurprinces-projects.vercel.app",
  "https://dev-deck.vercel.app",
  process.env.FRONTEND_URL
].filter(Boolean);

// Apply CORS middleware with configuration
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Check if the origin is in the allowed list or if it's a non-browser request
  if (allowedOrigins.includes(origin) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// API Documentation
swaggerDocs(app);

// Health check endpoint (excluded from rate limiting)
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// API Routes with error handling
const apiRoutesConfig = [
  { path: "/api/auth", handler: authRoutes },
  { path: "/api/projects", handler: projectRoutes },
  { path: "/api/sse", handler: sseRoutes },
  { path: "/api", handler: apiRoutes },
  { path: "/api/users", handler: usersRoutes }
];

apiRoutesConfig.forEach(route => {
  app.use(route.path, (req, res, next) => {
    Promise.resolve(route.handler(req, res, next))
      .catch(next);
  });  
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    status: 'error',
    message: `Cannot ${req.method} ${req.originalUrl}` 
  });
});

// Initialize Socket.IO with optimized settings
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "authorization", "x-requested-with"],
    credentials: true
  },
  // Optimizations
  pingTimeout: 30000, // 30 seconds
  pingInterval: 25000, // 25 seconds
  maxHttpBufferSize: 1e8, // 100MB
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  perMessageDeflate: false,
  path: "/socket.io/",
  serveClient: false,
  allowEIO3: true,
  connectTimeout: 30000,
  httpCompression: true,
  cookie: false
});

// Make io available to other modules
app.set('io', io);

// In-memory collaborators per project
const collaboratorsByProject = new Map();

// Helper to get or create project collaborators list
const getOrCreateProjectCollaborators = (projectId) => {
  if (!collaboratorsByProject.has(projectId)) {
    collaboratorsByProject.set(projectId, []);
  }
  return collaboratorsByProject.get(projectId);
};

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
      
      console.log(`User authenticated via WebSocket: ${socket.user.userId} (${socket.user.name || socket.user.email})` );
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
  socket.on('chatMessage', async (data, ack) => {
    console.log('Received chat message:', data);
    
    // Validate required fields
    if (!data.projectId || !data.text) {
      const errorMsg = 'Missing required fields in chat message';
      console.error(errorMsg, { 
        hasProjectId: !!data.projectId, 
        hasText: !!data.text 
      });
      if (ack && typeof ack === 'function') {
        ack({ status: 'error', message: errorMsg });
      }
      return;
    }
    
    // Validate sender information
    if (!data.sender || !data.sender._id) {
      const errorMsg = 'Missing sender information in chat message';
      console.error(errorMsg, { sender: data.sender });
      if (ack && typeof ack === 'function') {
        ack({ status: 'error', message: errorMsg });
      }
      return;
    }
    
    try {
      // Ensure projectId is a string
      const projectId = String(data.projectId);
      const isTemporaryMessage = data._id && data._id.startsWith('temp-');
      
      // Get user info from the socket (already authenticated)
      const userId = socket.user?.userId || data.sender?._id;
      if (!userId) {
        const errorMsg = 'No user ID found in socket.user or message data';
        console.error(errorMsg);
        if (ack && typeof ack === 'function') {
          ack({ status: 'error', message: errorMsg });
        }
        return;
      }
      
      // Get user data - prefer the data from the message first, then from socket, then fetch from DB
      let user = {
        _id: userId,
        name: data.sender?.name || socket.user?.name,
        email: data.sender?.email || socket.user?.email,
        username: data.sender?.username || socket.user?.username
      };
      
      // If we're missing any required fields, try to fetch from database
      if (!user.name || !user.email) {
        try {
          const dbUser = await User.findById(userId).select('name email username').lean();
          if (dbUser) {
            user = { ...user, ...dbUser };
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          // Continue with partial user data
        }
      }
      
      // Ensure we have all required fields
      if (!user.name) user.name = 'Anonymous';
      if (!user.email) user.email = `${user._id}@dev-deck.local`;
      if (!user.username) user.username = user.name?.toLowerCase().replace(/\s+/g, '_') || 'user';
      
      // Prepare sender info with proper fallbacks
      const senderInfo = {
        _id: user._id.toString(),
        name: user.name || user.username || 'User',
        username: user.username || user.email?.split('@')[0] || 'user',
        email: user.email || ''
      };
      
      // For temporary messages, don't save to database, just broadcast
      let message;
      if (isTemporaryMessage) {
        console.log('Processing temporary message, not saving to database');
        message = {
          _id: data._id,
          text: data.text,
          project: projectId,
          sender: user._id,
          senderInfo: {
            _id: user._id,
            name: user.name,
            email: user.email,
            username: user.username
          },
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
          isTemporary: true
        };
      } else {
        // For non-temporary messages, save to database
        try {
          message = new Message({
            text: data.text,
            project: projectId,
            sender: user._id,
            senderInfo: {
              _id: user._id,
              name: user.name,
              email: user.email,
              username: user.username
            },
            createdAt: data.createdAt ? new Date(data.createdAt) : new Date()
          });
          
          await message.save();
          console.log('Message saved to database:', message._id);
        } catch (saveError) {
          console.error('Error saving message to database:', saveError);
          if (ack && typeof ack === 'function') {
            ack({ 
              status: 'error', 
              message: 'Failed to save message',
              error: saveError.message
            });
          }
          return;
        }
      }
      
      // Prepare the complete message object for broadcasting
      const completeMessage = {
        _id: message._id.toString(),
        text: message.text,
        project: projectId,
        projectId: projectId,
        createdAt: message.createdAt,
        timestamp: message.createdAt ? new Date(message.createdAt).getTime() : Date.now(),
        sender: {
          _id: senderInfo._id,
          name: senderInfo.name,
          username: senderInfo.username,
          email: senderInfo.email
        },
        senderId: senderInfo._id,
        senderName: senderInfo.name,
        senderEmail: senderInfo.email
      };
      
      // Broadcast to all clients in the project room (including the sender)
      console.log('Broadcasting chat message to room:', projectId, completeMessage);
      io.to(projectId).emit('chatMessage', completeMessage);
      
      // Send acknowledgment back to sender if callback was provided
      if (ack && typeof ack === 'function') {
        ack({ 
          status: 'success', 
          message: 'Message sent successfully',
          messageId: completeMessage._id
        });
      }
    } catch (error) {
      console.error('Error in chatMessage handler:', error);
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      status: 'error',
      message: 'Invalid token' 
    });
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      status: 'error',
      message: 'Validation error',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }
  
  // Default error response
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start the server
const startServer = async () => {
  try {
    console.log("Attempting to connect to MongoDB...");
    await connectDB();
    console.log("MongoDB connected successfully");

    // Ensure indexes match the current schema
    try {
      await Project.syncIndexes();
      console.log("Project indexes synchronized");
    } catch (idxErr) {
      console.error("Failed to sync Project indexes:", idxErr);
    }
    
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();