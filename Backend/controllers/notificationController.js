import { Notification } from "../models/index.js";
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await Notification.find({ recipientId: userId }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, notifications });
    // console.log("....fetched data.... ");
  } catch (error) {
    // console.log("error in fetching , notifications ")
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const markAllNotificationsAsRead = async (req, res) => {
  const recipientId = req.params.id;

  try {
    const result = await Notification.updateMany(
      { recipientId, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
      modifiedCount: result.modifiedCount,
    });
    // console.log(".....UPDATED ....RESULT",result);
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notifications as read.",
      error: error.message,
    });
  }
};
export const markSingleNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const updated = await Notification.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.status(200).json({ message: "Marked as read", notification: updated });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: "Server error" });
  }
};