import mongoose from "mongoose";

const MedicalLeaveSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    healthRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HealthRecord",
      required: true,
    }, // New Field
    reason: { type: String, required: true }, // Short description of illness
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    supportingDocuments: [
      {
        url: String,
        publicId: String,
        format: String,
        resourceType: String
      }
    ],
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Admin approval (if required)
  },
  { timestamps: true }
);

export const MedicalLeave = mongoose.model("MedicalLeave", MedicalLeaveSchema);
