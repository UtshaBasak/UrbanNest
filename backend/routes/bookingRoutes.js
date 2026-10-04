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
import { registerObjectIdParams } from '../utils/request.js';

const router = express.Router();

registerObjectIdParams(router, ['id']);

// Validation rules
const statusUpdateValidation = [
  body('status').isIn(['approved', 'rejected']).withMessage('Invalid status'),
  body('rejectionReason').optional().isString().isLength({ max: 500 }).withMessage('Rejection reason too long')
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