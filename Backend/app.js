import express from "express";
import http from "http";
import { Server } from "socket.io"; 
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import jwt from "jsonwebtoken";
import connectDB from "./db/database.js";
import Routes from "./routes/index.js";
import testRoutes from "./routes/testRoutes.js";


const app = express();
dotenv.config();  
connectDB();
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5000"], // Correct syntax
    credentials: true,
  })
);
app.use("/api/v1", Routes);



// Create an HTTP server and integrate with Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5000"],
    credentials: true,
  },
});


// Store online users
const onlineUsers = new Map();  
app.set("onlineUsers", onlineUsers); // ✅ Store online users globally


import cookie from "cookie";

io.use((socket, next) => {
  // Parse cookies manually
  const cookies = socket.request.headers.cookie ? cookie.parse(socket.request.headers.cookie) : {};
  const token = cookies.jwt || socket.handshake.auth.token; // Extract JWT token from cookies

  // console.log("Extracted Token:", token); // Debugging

  if (!token) {
    console.log("No token found, user not authenticated!");
    return next(new Error("Authentication error"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded; // Attach user info to the socket
    next();
  } catch (err) {
    console.error("JWT Verification Failed:", err);
    return next(new Error("Authentication error"));
  }
});

// When a new client connects
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);  // Log the new connection

  // Authenticate user with JWT when they connect
  socket.on("authenticate", (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);  
      socket.userId = decoded.id;  
      onlineUsers.set(socket.userId, socket); 
      console.log(`User authenticated: ${socket.userId}`);
    } catch (err) {
      console.log("Authentication failed");
      socket.emit("authError", { message: "Authentication failed, please reconnect." });
      socket.disconnect(); 
    }
  });

  
  // Store the user ID when they connect
  socket.on("setUserId",async (userId) => {
    onlineUsers.set(userId, socket);
    console.log(`User ${userId} is online.`);
  });
  

  //listen for new appointment(doc gets)
  socket.on("newAppointment", (appointmentData) => {
    console.log("New appointment request received:", appointmentData);
    if (!appointmentData.doctorId) {
      console.error("Missing doctorId in new appointment data!");
      return;
    }
    const doctorSocket = onlineUsers.get(appointmentData.doctorId);
    if (doctorSocket) {
      doctorSocket.emit("newAppointment", { message: "New appointment request!", appointment: appointmentData });
    } else {
      console.log(`Doctor ${appointmentData.doctorId} is offline.`);
    }
  });
  
  // ✅ Listen for appointment updates (Patient should receive)
  socket.on("appointmentUpdate", (updateData) => {
    console.log("Appointment update received:", updateData);
    if (!updateData.patientId) {
      console.error("Missing patientId in appointment update data!");
      return;
    }
    const patientSocket = onlineUsers.get(updateData.patientId);
    if (patientSocket) {
      patientSocket.emit("appointmentUpdate", { message: `Your appointment is ${updateData.status}`, appointment: updateData });
    }
  });

  
  // When a user disconnects
  socket.on("disconnect", () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
    }
    console.log("User disconnected:", socket.id);
  })
});

app.set("socketio",io);

const PORT = process.env.PORT || 3053;
server.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
});


