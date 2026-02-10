// backend/utils/mailer.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Create reusable transporter
// console.log(process.env.EMAIL_USER);
// console.log(process.env.EMAIL_PASS)
const transporter = nodemailer.createTransport({
  service: "gmail", // or use another SMTP provider

  auth: {
    user: process.env.EMAIL_USER,       // Platform's email (from .env)
    pass: process.env.EMAIL_PASS,       // App password (NOT real password)
  },
});

/**
 * Send an email using Nodemailer
 * @param {string} to - Recipient email address
 * @param {string} subject - Subject of the email
 * @param {string} text - Plain text fallback
 * @param {string} html - HTML content (optional)
 */
const sendMail = async (to, subject, text, html = null) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    // console.log("✅ Email sent:", info.response);
    return info;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw error;
  }
};

export default sendMail;
