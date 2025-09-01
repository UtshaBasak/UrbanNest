import express from 'express';
import { body } from 'express-validator';
import {
  createBooking,
  getMyBookings,
  updateBookingStatus,
  cancelBooking,
  deleteBooking
} from '../controllers/bookingController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = express.Router();

// Validation rules (relaxed for create booking)

const statusUpdateValidation = [
  body('status').isIn(['approved', 'rejected']).withMessage('Invalid status'),
  body('rejectionReason').optional().isLength({ max: 500 }).withMessage('Rejection reason too long')
];

// Routes
router.post('/', 
  authenticateToken, 
  authorize('tenant'), 
  createBooking
);

router.get('/my', authenticateToken, getMyBookings);

router.put('/:id/status', 
  authenticateToken, 
  authorize('owner', 'admin'), 
  statusUpdateValidation, 
  updateBookingStatus
);

router.put('/:id/cancel', 
  authenticateToken, 
  authorize('tenant'), 
  cancelBooking
);

router.delete('/:id', 
  authenticateToken, 
  deleteBooking
);

export default router;