import { HealthRecord } from "../models/healthRecordModel.js";
import { uploadMultipleDocuments } from "../utils/cloudinary.js";
import fs from 'fs';

// Create a new health record
export const createHealthRecord = async (req, res) => {
  try {
    // console.log("Request Body:", req.body);

    const { diagnosis, treatment, prescription, externalDoctorName, externalHospitalName } = req.body;
    const studentId = req.user.id;
    const isManualUpload = req.body.isManualUpload === "true"; // Get student ID from authenticated user
    let doctorId;

    if (isManualUpload) {
      doctorId = null;
    } else if (!req.body.doctorId || req.body.doctorId === "") {
      return res.status(400).json({ message: "Doctor ID is required" });
    } else {
      doctorId = req.body.doctorId;
    }

    if (!diagnosis || !treatment) {
      return res.status(400).json({ message: "Diagnosis and treatment are required" });
    }

    let attachments = [];
    if (req.files && req.files.length > 0) {
      // console.log("Files received:", req.files);
      const filePaths = req.files.map(file => file.path);
      const uploadResults = await uploadMultipleDocuments(filePaths);
      // console.log("Upload results:", uploadResults);

      attachments = uploadResults.map(result => ({
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format
      }));
      // Clean up temp files after upload
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.log(`Failed to delete temp file: ${file.path}`, err);
        });
      });
    }

    const newRecord = new HealthRecord({
      studentId,
      doctorId,
      diagnosis,
      treatment,
      prescription,
      isManualUpload,
      externalDoctorName,
      externalHospitalName,
      attachments, // Handle file uploads
    });
    // console.log("Attachments before saving:", attachments);

    await newRecord.save();
    res.status(201).json({ message: "Health record created successfully", newRecord });
  } catch (error) {
    console.error("Error creating health record:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// Get all health records for the logged-in student
export const getHealthRecords = async (req, res) => {
  try {
    const records = await HealthRecord.find({ studentId: req.user.id });
    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ message: "Error fetching health records", error });
  }
};

// Get a single health record by ID
export const getHealthRecordById = async (req, res) => {
  try {
    const record = await HealthRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Health record not found" });

    if (record.studentId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }
    res.status(200).json(record);
  } catch (error) {
    res.status(500).json({ message: "Error fetching health record", error });
  }
};

// Update a health record
export const updateHealthRecord = async (req, res) => {
  try {
    const record = await HealthRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Health record not found" });

    if (record.studentId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    Object.assign(record, req.body);
    await record.save();
    res.status(200).json({ message: "Health record updated successfully", record });
  } catch (error) {
    res.status(500).json({ message: "Error updating health record", error });
  }
};

// Delete a health record
export const deleteHealthRecord = async (req, res) => {
  try {
    const record = await HealthRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Health record not found" });

    if (record.studentId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    await record.deleteOne();
    res.status(200).json({ message: "Health record deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting health record", error });
  }
};




export const getHealthRecordsadmin = async (req, res) => {
  try {
    // Fetch all health records and populate student and doctor details
    const healthRecords = await HealthRecord.find()
      .populate("studentId", "name gender email phone dateOfBirth") // Populate student details
      .populate("doctorId", "name specialization email phone"); // Populate doctor details

    // Format the records for the frontend
    const formattedRecords = healthRecords.map((record) => ({
      id: record._id,
      studentName: record.studentId?.name || "Unknown",
      studentId: record.studentId?._id || null,
      gender: record.studentId?.gender || "Unknown",
      diagnosis: record.diagnosis,
      date: record.date.toISOString().split("T")[0],
      prescription: record.prescription || "No prescription provided",
      attachments: record.attachments.map(att => ({
        url: att.url || null,
        format: att.url ? att.url.split('.').pop().toLowerCase() : null,
      })),
      doctorName: record.isManualUpload
        ? record.externalDoctorName
        : record.doctorId?.name || "Unknown",
      hospitalName: record.isManualUpload ? record.externalHospitalName : null,
    }));
    // console.log("Formatted records:", formattedRecords);
    res.status(200).json(formattedRecords);
  } catch (error) {
    console.error("Error fetching health records:", error);
    res.status(500).json({ message: error.message });
  }
};


//Search



export const searchHealthRecords = async (req, res) => {
  try {
    const { query } = req.query;
    const studentId = req.user.id;
    // console.log("Search query:", query);
    // console.log("Student ID:", studentId);

    const records = await HealthRecord.find({
      studentId,
      $or: [
        { diagnosis: { $regex: query, $options: "i" } },
        { treatment: { $regex: query, $options: "i" } },
        { prescription: { $regex: query, $options: "i" } },
        { externalDoctorName: { $regex: query, $options: "i" } },
        { externalHospitalName: { $regex: query, $options: "i" } },
      ],
    });

    // console.log("Records found:", records.length);
    res.status(200).json(records);
  } catch (error) {
    console.error("Error searching health records:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const getSearchSuggestions = async (req, res) => {
  try {
    const { query } = req.query; // User's input
    const studentId = req.user.id; // Authenticated user ID

    if (!query) {
      return res.status(400).json({ message: "Query parameter is required" });
    }

    // Fetch suggestions based on partial matches
    const suggestions = await HealthRecord.find({
      studentId,
      $or: [
        { diagnosis: { $regex: query, $options: "i" } },
        { treatment: { $regex: query, $options: "i" } },
        { prescription: { $regex: query, $options: "i" } },
        { externalDoctorName: { $regex: query, $options: "i" } },
        { externalHospitalName: { $regex: query, $options: "i" } },
      ],
    }).limit(5); // Limit the number of suggestions

    // Extract unique suggestions (e.g., diagnosis names)
    const uniqueSuggestions = [...new Set(suggestions.map(s => s.diagnosis))];

    res.status(200).json(uniqueSuggestions);
  } catch (error) {
    console.error("Error fetching search suggestions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};