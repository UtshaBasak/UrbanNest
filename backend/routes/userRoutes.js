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
  removeFavourite
} from '../controllers/userController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const router = express.Router();

// Validation rules
const statusUpdateValidation = [
  body('isActive').isBoolean().withMessage('isActive must be a boolean')
];

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
router.get('/:id', getUser);

router.put('/:id/status', 
  authenticateToken, 
  authorize('admin'), 
  statusUpdateValidation, 
  updateUserStatus
);

// Delete user (self or admin). If owner, cascade deletes related data
router.delete('/:id', authenticateToken, deleteUser);

export default router;