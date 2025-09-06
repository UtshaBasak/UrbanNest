import express from 'express';
import {
  getOwners,
  getTenants,
  getProperties,
  deleteUserById,
  deletePropertyById,
  getAdminStats,
  getAllReviews,
  deleteReviewById
} from '../controllers/adminController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken, authorize('admin'));

// Admin statistics
router.get('/stats', getAdminStats);

// Owner management
router.get('/owners', getOwners);

// Tenant management
router.get('/tenants', getTenants);

// Property management
router.get('/properties', getProperties);
router.delete('/properties/:id', deletePropertyById);

// User management
router.delete('/users/:id', deleteUserById);

// Review management
router.get('/reviews', getAllReviews);
router.delete('/reviews/:id', deleteReviewById);

export default router;
