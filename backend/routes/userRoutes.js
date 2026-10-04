import express from 'express';
import { body } from 'express-validator';

import {
  getUsers,
  getUser,
  searchUsers,
  updateUserStatus,
  deleteUser,
  canViewTenantContact,
  getMyFavourites,
  addFavourite,
  removeFavourite,
  updateUserProfile
} from '../controllers/userController.js';
import { authenticateToken, authorize, optionalAuth } from '../middleware/auth.js';
import { registerObjectIdParams, normalizePhone, PHONE_PATTERN } from '../utils/request.js';

const router = express.Router();

// Reject malformed ids with 400 before they reach the controllers
registerObjectIdParams(router, ['id', 'itemId']);


// Validation rules
const statusUpdateValidation = [
  body('isActive').isBoolean().withMessage('isActive must be a boolean').toBoolean()
];

const profileUpdateValidation = [
  body('name').optional().isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('phone').optional().customSanitizer(normalizePhone).matches(PHONE_PATTERN).withMessage('Please enter a valid phone number'),
  body('profileImage').optional().isString().withMessage('Profile image must be a string'),
  body('role').optional().isIn(['owner', 'tenant']).withMessage('Role must be owner or tenant')
];

// Update user profile (self or admin)
router.put('/:id', authenticateToken, profileUpdateValidation, updateUserProfile);

// Routes
// Public user listing to support Owners/Tenants directory pages
router.get('/', getUsers);
router.get('/search', searchUsers);
// Favourites (tenant)
router.get('/me/favourites', authenticateToken, getMyFavourites);
router.post('/me/favourites', authenticateToken, addFavourite);
router.delete('/me/favourites/:itemType/:itemId', authenticateToken, removeFavourite);
// Contact visibility check (must be above '/:id' to avoid shadowing)
router.get('/:id/can-view-contact', authenticateToken, canViewTenantContact);
router.get('/:id', optionalAuth, getUser);

router.put('/:id/status', 
  authenticateToken, 
  authorize('admin'), 
  statusUpdateValidation, 
  updateUserStatus
);

// Delete user (self or admin). If owner, cascade deletes related data
router.delete('/:id', authenticateToken, deleteUser);

export default router;