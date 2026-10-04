import express from 'express';
import { authenticateToken, authorize } from '../middleware/auth.js';
import { registerObjectIdParams } from '../utils/request.js';
import { createLeaveRequest, listMyLeaveRequests, decideLeaveRequest } from '../controllers/leaveRequestController.js';

const router = express.Router();

registerObjectIdParams(router, ['id', 'userId', 'propertyId']);

// Tenant creates a leave request
router.post('/', authenticateToken, authorize('tenant'), createLeaveRequest);

// Tenant Owner list their leave requests
router.get('/my', authenticateToken, authorize('tenant', 'owner', 'admin'), listMyLeaveRequests);

// Owner/Admin decides on a leave request
router.put('/:id/decision', authenticateToken, authorize('owner', 'admin'), decideLeaveRequest);

export default router;
