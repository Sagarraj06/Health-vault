// utils/cloudinary.js
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  cloud_name: process.env.CLOUD_NAME,
});

// Upload a single document to Cloudinary
export const uploadDocument = async (file) => {
  try {
    const uploadResponse = await cloudinary.uploader.upload(file, {
      resource_type: "auto",
      folder: "medical_documents" // Organize files in a specific folder
    });
    return uploadResponse;
  } catch (error) {
    // console.log("Document upload error:", error);
    throw new Error(`Upload failed: ${error.message}`);
  }
};

// Upload multiple documents to Cloudinary
export const uploadMultipleDocuments = async (files) => {
  try {
    // If files is not an array or is empty, return empty array
    if (!Array.isArray(files) || files.length === 0) {
      return [];
    }

    // Upload all files in parallel
    const uploadPromises = files.map(file => uploadDocument(file));
    const uploadResults = await Promise.all(uploadPromises);

    // Return array of upload results
    return uploadResults;
  } catch (error) {
    // console.log("Error uploading multiple documents:", error);
    throw new Error(`Multiple upload failed: ${error.message}`);
  }
};

export const deleteDocumentFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    // console.log("Error deleting document:", error);
    throw new Error(`Delete failed: ${error.message}`);
  }
};