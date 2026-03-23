import express from "express";
import { signup, login, logout, getAllDoctors, getDoctorAvailableTimeSlots } from "../controllers/userController.js";
import { searchHealthRecords, getSearchSuggestions } from "../controllers/healthRecordController.js";
import {authMiddleware} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);



router.get("/search", authMiddleware(["student"]),searchHealthRecords);
router.get("/searchSuggestions", authMiddleware(["student"]),getSearchSuggestions);



router.get("/doctors", getAllDoctors);
router.get("/doctor/:doctorId/available-slots", getDoctorAvailableTimeSlots);

export default router;
