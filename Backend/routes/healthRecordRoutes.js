import express from "express";
import {
  createHealthRecord,
  getHealthRecords,
  getHealthRecordById,
  updateHealthRecord,
  deleteHealthRecord,
} from "../controllers/healthRecordController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import upload from "../utils/multer.js";

const router = express.Router();

// Routes for student health records
router.post('/create',authMiddleware(["student"]), upload.array('attachments'), createHealthRecord);
router.get("/", authMiddleware(["student"]), getHealthRecords);
router.get("/:id", authMiddleware(["student"]), getHealthRecordById);
router.put("/:id/update", authMiddleware(["student"]), updateHealthRecord);
router.delete("/:id/delete", authMiddleware(["student"]), deleteHealthRecord);

export default router;
