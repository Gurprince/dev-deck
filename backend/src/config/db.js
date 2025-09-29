// backend/src/config/db.js
import mongoose from "mongoose";
import { envConfig } from "./env.js";

// Connection config
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

// Connection events
mongoose.connection.on('connecting', () => {
  console.log('Connecting to MongoDB...');});

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected successfully');});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');});

mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error:', error);
  // Don't exit process here, let the retry logic handle it
});

export const connectDB = async (retryCount = 0) => {
  try {
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 100, // Maximum number of connections in the connection pool
      serverSelectionTimeoutMS: 5000, // Time before server selection throws error
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
    };

    await mongoose.connect(envConfig.mongodbUri, options);
    return true;
  } catch (error) {
    console.error(`MongoDB connection error (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error.message);
    
    if (retryCount < MAX_RETRIES - 1) {
      console.log(`Retrying in ${RETRY_DELAY/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return connectDB(retryCount + 1);
    }
    
    console.error('Max retries reached. Could not connect to MongoDB');
    process.exit(1);
  }
};
