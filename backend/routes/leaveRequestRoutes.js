import express from 'express';
import { authenticateToken, authorize } from '../middleware/auth.js';
import { createLeaveRequest, listMyLeaveRequests, decideLeaveRequest } from '../controllers/leaveRequestController.js';

const router = express.Router();

// Tenant creates a leave request
router.post('/', authenticateToken, authorize('tenant'), createLeaveRequest);

// Tenant Owner list their leave requests
router.get('/my', authenticateToken, authorize('tenant', 'owner', 'admin'), listMyLeaveRequests);

// Owner/Admin decides on a leave request
router.put('/:id/decision', authenticateToken, authorize('owner', 'admin'), decideLeaveRequest);

export default router;
