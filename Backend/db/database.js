import mongoose from "mongoose";
import dotenv from "dotenv";

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            socketTimeoutMS: 30000,
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
            retryWrites: true,
            w: 'majority'
        });
        console.log("✅ MongoDB connected successfully");
    } catch (error) {
        console.error("❌ MongoDB connection failed:", error.message);
        console.warn("⚠️ Some features may not work properly without database connection");
        // Don't exit - allow app to run in limited mode
        // process.exit(1);
    }
};

export default connectDB;