import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getMyNotifications, markAsRead, markAsUnread, markAllAsRead, markAllAsUnread, deleteNotification } from '../controllers/notificationController.js';

const router = express.Router();

// All routes require auth
router.get('/my', authenticateToken, getMyNotifications);
router.put('/:id/read', authenticateToken, markAsRead);
router.put('/:id/unread', authenticateToken, markAsUnread);
router.put('/read-all', authenticateToken, markAllAsRead);
router.put('/unread-all', authenticateToken, markAllAsUnread);
router.delete('/:id', authenticateToken, deleteNotification);

export default router;
