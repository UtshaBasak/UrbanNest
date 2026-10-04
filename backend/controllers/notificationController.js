import Notification from '../models/Notification.js';
import { parsePagination } from '../utils/request.js';

// Create a notification
export const createNotification = async ({ user, title, message, link = '', meta = {} }) => {
  const notif = new Notification({ user, title, message, link, meta });
  await notif.save();
  return notif;
};

// Get my notifications
export const getMyNotifications = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { user: req.user._id };
    if (String(req.query.unreadOnly) === 'true') filter.read = false;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(filter)
    ]);

    res.json({ data: { notifications, total, page, limit } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await Notification.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { $set: { read: true } },
      { returnDocument: 'after' }
    );
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    res.json({ data: { notification: notif } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark as read' });
  }
};

// Mark notification as unread
export const markAsUnread = async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await Notification.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { $set: { read: false } },
      { returnDocument: 'after' }
    );
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    res.json({ data: { notification: notif } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark as unread' });
  }
};

// Mark all as read
export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
    res.json({ data: { success: true } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark all as read' });
  }
};

// Mark all as unread
export const markAllAsUnread = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: true }, { $set: { read: false } });
    res.json({ data: { success: true } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark all as unread' });
  }
};

// Delete a notification
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Notification.findOneAndDelete({ _id: id, user: req.user._id });
    if (!deleted) return res.status(404).json({ message: 'Notification not found' });
    res.json({ data: { success: true } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete notification' });
  }
};
