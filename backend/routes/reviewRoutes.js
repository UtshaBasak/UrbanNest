import express from 'express';
import { body } from 'express-validator';
import {
  createReview,
  getPropertyReviews,
  getMyReviews,
  updateReview,
  deleteReview,
  canReviewCheck
} from '../controllers/reviewController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = express.Router();

// Validation rules
const reviewValidation = [
  body('property').isMongoId().withMessage('Invalid property ID'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').trim().isLength({ min: 10, max: 500 }).withMessage('Comment must be between 10 and 500 characters')
];

// Routes
// Eligibility check first to avoid shadowing
router.get('/can-review/check', authenticateToken, authorize('tenant'), canReviewCheck);
router.post('/', 
  authenticateToken, 
  authorize('tenant'), 
  reviewValidation, 
  createReview
);

router.get('/property/:propertyId', getPropertyReviews);
router.get('/my', authenticateToken, getMyReviews);

router.put('/:id', 
  authenticateToken, 
  authorize('tenant'), 
  reviewValidation, 
  updateReview
);

router.delete('/:id', 
  authenticateToken, 
  authorize('tenant', 'admin'), 
  deleteReview
);

export default router;