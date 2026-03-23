import express from "express";
import { applyMedicalLeave, getLeaveStatus, getAllLeaveApplications } from "../controllers/medicalLeaveController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import upload from "../utils/multer.js";

const router = express.Router();

// Apply the multer middleware BEFORE the controller, but AFTER auth
router.post(
  "/apply", 
  authMiddleware(["student"]), 
  upload.array('supportingDocuments', 5),  // This handles the file upload
  applyMedicalLeave  // This processes the form after files are handled
);
router.get("/", authMiddleware(["student", "admin"]), getAllLeaveApplications);
router.get("/status", authMiddleware(["student"]), getLeaveStatus);

export default router;