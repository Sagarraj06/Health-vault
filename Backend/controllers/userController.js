import { User } from "../models/userModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
// Generate JWT Token & Set Cookie
const generateToken = (res, user) => {
  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  // console.log("Generated JWT Token:", token);
  res.cookie("jwt", token, { httpOnly: true });
  return token;
  // res.json({ token, userData: user, role: user.role });
};

// User Signup
export const signup = async (req, res) => {
  // console.log("Signup Controller Hit!");
  // console.log("Request Body:", req.body);
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      dateOfBirth,
      gender,
      specialization,
      availableSlots,
    } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      phone,
      dateOfBirth,
      gender,
      specialization: role === "doctor" ? specialization : undefined, // Only for doctors
      availableSlots: role === "doctor" ? availableSlots || [] : undefined, // Only for doctors
    });

    generateToken(res, user);
    res.status(201).json({ message: "Signup successful", user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// User Login
export const login = async (req, res) => {
  // console.log("login Controller Hit!");
  // console.log("Request Body:", req.body);
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(res, user);
    return res.status(200).json({
      token,
      role: user.role,
      userData: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};
// User Logout
export const logout = (req, res) => {
  res.clearCookie("jwt");
  res.json({ message: "Logged out successfully" });
};

export const getAllDoctors = async (req, res) => {
  try {
    const doctors = await User.find({ role: "doctor" });
    res.status(200).json(doctors);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getDoctorAvailableTimeSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Date parameter is required" });
    }

    const doctor = await User.findOne({ _id: doctorId, role: "doctor" });
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const queryDate = new Date(date);
    const startOfDay = new Date(queryDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(queryDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get available slots for the specified date
    const availableSlots = doctor.availableSlots
      .filter(
        (slot) =>
          slot.dateTime >= startOfDay &&
          slot.dateTime <= endOfDay &&
          !slot.isBooked
      )
      .map((slot) => ({
        id: slot._id,
        time: slot.dateTime.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      }))
      .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

    res.status(200).json(availableSlots);
  } catch (error) {
    console.error("Error fetching available slots:", error);
    res.status(500).json({ message: "Server error" });
  }
};
