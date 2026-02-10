import { MedicalLeave } from "../models/medicalLeaveModel.js";
import { User } from "../models/userModel.js";
import { HealthRecord } from "../models/healthRecordModel.js";
import { Notification } from "../models/notificationModel.js"

import sendMail from "../utils/mailer.js";

export const getMedicalLeaveApplications = async (req, res) => {
  try {
    const leaves = await MedicalLeave.find()
      .populate("studentId", "name gender email phone dateOfBirth")
      .populate("healthRecordId", "diagnosis treatment prescription date doctorId isManualUpload externalDoctorName externalHospitalName attachments")
      .populate("approvedBy", "name email");

    const formattedLeaves = leaves.map((leave) => {
      // Handle cases where associated data might be missing
      const studentName = leave.studentId ? leave.studentId.name : "Unknown";
      const studentId = leave.studentId ? leave.studentId._id : null;
      const gender = leave.studentId ? leave.studentId.gender : "Unknown";

      // Safely format dates
      const fromDateStr = leave.fromDate ? leave.fromDate.toISOString().split("T")[0] : "N/A";
      const toDateStr = leave.toDate ? leave.toDate.toISOString().split("T")[0] : "N/A";

      return {
        id: leave._id, // Always use id in the response to match frontend expectation
        _id: leave._id, // Include original _id as well for safety
        studentName,
        studentId,
        gender,
        duration: `${fromDateStr} to ${toDateStr}`,
        fromDate: fromDateStr,
        toDate: toDateStr,
        diagnosis: leave.healthRecordId ? leave.healthRecordId.diagnosis : null,
        status: leave.status,
      };
    });

    res.status(200).json(formattedLeaves);
  } catch (error) {
    console.error("Error in getMedicalLeaveApplications:", error);
    res.status(500).json({ message: error.message });
  }
};



export const updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized: Admin ID missing" });
    }

    const leave = await MedicalLeave.findByIdAndUpdate(
      id,
      { status, approvedBy: req.user.id }, // Assuming `req.user.id` contains admin ID
      { new: true }
    );

    if (!leave) {
      return res.status(404).json({ message: "Medical leave not found" });
    }
    //store in mongodb
    const notification = new Notification({
      recipientId: leave.studentId,
      type: "leave",
      message: `Your leave request has been ${status}.`,
    });
    const io = req.app.get("socketio"); // Get Socket.io instance
    const studentSocket = req.app.get("onlineUsers").get(leave.studentId.toString());

    if (studentSocket) {
      studentSocket.emit("newNotification", {
        notification, leave,
      });


    }
    else {
    }

    //sending mail 
    try {
      const studentDetails = await User.findById(leave.studentId).select("name email");
      if (studentDetails?.email) {
        const mailSubject = `📝 Medical Leave ${status}`;
        const mailText = `Your medical leave request has been ${status}.`;
        const mailHtml = `
            <h3>Medical Leave Status Update</h3>
            <p><strong>Student:</strong> ${studentDetails.name}</p>
            <p><strong>Status:</strong> <span style="text-transform: capitalize;">${status}</span></p>
            <p>Your medical leave request has been <strong>${status}</strong>.</p>
          `;

        await sendMail(
          studentDetails.email,
          mailSubject,
          mailText,
          mailHtml
        );

      } else {
      }
    } catch (emailError) {
      console.error("❌ Error sending email to student:", emailError);
    }


    res.status(200).json({ message: `Leave ${status} successfully`, leave });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const viewLeaveDetails = async (req, res) => {
  try {

    const { id } = req.params;

    const leave = await MedicalLeave.findById(id)
      .populate({
        path: "studentId",
        select: "name gender email phone dateOfBirth"
      })
      .populate({
        path: "healthRecordId",
        select: "diagnosis treatment prescription date doctorId isManualUpload externalDoctorName externalHospitalName attachments",
        populate: {
          path: "doctorId",
          select: "name "
        }
      })
      .populate("approvedBy", "name email");

    if (!leave) {
      return res.status(404).json({ message: "Medical leave not found" });
    }

    const detailedLeave = {
      id: leave._id,
      studentName: leave.studentId.name,
      studentId: leave.studentId._id,
      gender: leave.studentId.gender,
      email: leave.studentId.email,
      phone: leave.studentId.phone,
      dateOfBirth: leave.studentId.dateOfBirth?.toISOString().split("T")[0] || null,
      duration: `${leave.fromDate.toISOString().split("T")[0]} to ${leave.toDate.toISOString().split("T")[0]}`,
      reason: leave.reason,
      status: leave.status,
      diagnosis: leave.healthRecordId?.diagnosis || null,
      treatment: leave.healthRecordId?.treatment || null,
      prescription: leave.healthRecordId?.prescription || null,
      doctorName: leave.healthRecordId?.isManualUpload
        ? leave.healthRecordId.externalDoctorName
        : leave.healthRecordId?.doctorId?.name || null,
      hospitalName: leave.healthRecordId?.isManualUpload
        ? leave.healthRecordId.externalHospitalName
        : null,
      //attachments: leave.healthRecordId?.attachments || [],
      supportingDocuments: leave.supportingDocuments || [],
      approvedBy: leave.approvedBy ? { name: leave.approvedBy.name, email: leave.approvedBy.email } : null,
    };
    //console.log("Attachments:", leave.healthRecordId?.attachments);
    // console.log("Attachments:", leave.supportingDocuments);
    // console.log(leave.healthRecordId?.doctorId?.externalDoctorName);
    // console.log(leave.healthRecordId?.doctorId?.name);
    res.status(200).json(detailedLeave);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const adminSearchHealthRecords = async (req, res) => {
  try {
    const { query } = req.query;

    // Create the base query conditions
    const searchConditions = [
      { diagnosis: { $regex: query, $options: "i" } },
      { treatment: { $regex: query, $options: "i" } },
      { prescription: { $regex: query, $options: "i" } },
      { externalDoctorName: { $regex: query, $options: "i" } },
      { externalHospitalName: { $regex: query, $options: "i" } }
    ];

    // Find users (both students and doctors) that match the query
    const matchingUsers = await User.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { specialization: { $regex: query, $options: "i" } }
      ]
    });

    // Extract IDs of matching users based on their role
    const studentIds = matchingUsers
      .filter(user => user.role === "student")
      .map(student => student._id);

    const doctorIds = matchingUsers
      .filter(user => user.role === "doctor")
      .map(doctor => doctor._id);

    // Add user IDs to search conditions if any were found
    if (studentIds.length > 0) {
      searchConditions.push({ studentId: { $in: studentIds } });
    }

    if (doctorIds.length > 0) {
      searchConditions.push({ doctorId: { $in: doctorIds } });
    }

    // Execute the search with all conditions
    const records = await HealthRecord.find({
      $or: searchConditions
    })
      .populate("studentId", "name")
      .populate("doctorId", "name specialization");

    res.status(200).json(records);
  } catch (error) {
    console.error("Error in admin search for health records:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const adminGetSearchSuggestions = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ message: "Query parameter is required" });
    }

    // Get suggestions from health records
    const recordSuggestions = await HealthRecord.find({
      $or: [
        { diagnosis: { $regex: query, $options: "i" } },
        { treatment: { $regex: query, $options: "i" } },
        { prescription: { $regex: query, $options: "i" } },
        { externalDoctorName: { $regex: query, $options: "i" } },
        { externalHospitalName: { $regex: query, $options: "i" } }
      ]
    }).limit(5);

    // Get suggestions from users (students and doctors)
    const userSuggestions = await User.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { specialization: { $regex: query, $options: "i" } }
      ]
    }).limit(5);

    // Combine and deduplicate suggestions
    const diagnosisSuggestions = [...new Set(recordSuggestions.map(r => r.diagnosis))];
    const nameSuggestions = [...new Set(userSuggestions.map(u => u.name))];
    const specializationSuggestions = [...new Set(
      userSuggestions
        .filter(u => u.role === "doctor" && u.specialization)
        .map(d => d.specialization)
    )];

    // Combine all suggestion types
    const allSuggestions = [
      ...diagnosisSuggestions,
      ...nameSuggestions,
      ...specializationSuggestions
    ].filter(Boolean).slice(0, 10); // Take top 10 non-null suggestions

    res.status(200).json(allSuggestions);
  } catch (error) {
    console.error("Error fetching admin search suggestions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};