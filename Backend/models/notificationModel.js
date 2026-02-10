import mongoose from "mongoose";
const notificationSchema = new mongoose.Schema(
    {
      recipientId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
      }, // The user receiving the notification
      type: { type: String, enum: ["appointment", "leave"], required: true },
      message: { type: String, required: true },
      isRead: { type: Boolean, default: false }, // Track if the user has seen it
    },
    { timestamps: true } // Automatically adds createdAt and updatedAt fields
  );

export const Notification = mongoose.model("Notification", notificationSchema);