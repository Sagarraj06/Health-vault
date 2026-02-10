import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Hashed
    role: {
      type: String,
      enum: ["student", "doctor", "admin"],
      required: true,
    },

    phone: { type: String },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ["Male", "Female", "Other"] },

    // Students
    healthRecords: [
      { type: mongoose.Schema.Types.ObjectId, ref: "HealthRecord" },
    ],

    // Doctors
    specialization: { type: String }, // Only for doctors
    availableSlots: [
      {
        dateTime: { type: Date, required: true }, // Full datetime of the appointment slot
        isBooked: { type: Boolean, default: false }
      }
    ],
  },
  { timestamps: true }
);



export const User = mongoose.model("User", UserSchema);
