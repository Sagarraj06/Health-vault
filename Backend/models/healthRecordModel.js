import mongoose from "mongoose";

const HealthRecordSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Null if manually uploaded
    diagnosis: { type: String, required: true },
    treatment: { type: String },
    prescription: { type: String },
    date: { type: Date, default: Date.now },

    // Manually uploaded records (if from external doctor)
    isManualUpload: { type: Boolean, default: false },
    externalDoctorName: { type: String }, // Name of doctor (if outside platform)
    externalHospitalName: { type: String }, // Hospital/clinic name (if external)
    attachments: [{
      url: String,
      publicId: String,
      format: String,
      
    }], // File URLs
  },
  { timestamps: true }
);

export const HealthRecord = mongoose.model("HealthRecord", HealthRecordSchema);