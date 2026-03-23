import express from "express";
import sendMail from "../utils/mailer.js";

const router = express.Router();
router.get("/send-test-email", async (req, res) => {
    try {
      await sendMail(
        "mufaddalcloudarcade@gmail.com", // Replace this with your email to test
        "✅ Test Email from Your Platform",
        "This is a plain text version of the test email.",
        `
          <h2>Hello from the backend!</h2>
          <p>This is a <strong>test email</strong> sent using <code>nodemailer</code>.</p>
          <p>🚀 You're all set to send real notifications now!</p>
        `
      );
  
      res.status(200).json({ message: "Test email sent successfully!" });
    } catch (error) {
      res.status(500).json({ message: "Failed to send test email.", error: error.message });
    }
  });
  
  export default router;