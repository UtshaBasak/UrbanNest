import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createRating, getRatingSummary, listRatings, canRateCheck, deleteRating } from '../controllers/ratingController.js';

const router = express.Router();

// Private: eligibility check first (avoid shadowing by :userId)
router.get('/can-rate/check', authenticateToken, canRateCheck);

// Public: summary and list
router.get('/:userId/summary', getRatingSummary);
router.get('/:userId', listRatings);

// Private: create rating
router.post('/', authenticateToken, createRating);

// Private: delete rating
router.delete('/:id', authenticateToken, deleteRating);

export default router;
