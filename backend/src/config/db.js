// backend/src/config/db.js
import mongoose from "mongoose";
import { envConfig } from "./env.js";

export const connectDB = async () => {
  try {
    await mongoose.connect(envConfig.mongodbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};
