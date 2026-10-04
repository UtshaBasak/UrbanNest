import express from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  logout,
  getCurrentUser,
  updateCurrentUser,
  deleteCurrentUser
} from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
import { normalizePhone, PHONE_PATTERN } from '../utils/request.js';


const router = express.Router();

// Validation rules
const registerValidation = [
  body('name').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      gmail_convert_googlemaildotcom: false,
    })
    .withMessage('Please enter a valid email'),
  body('password').isString().isLength({ min: 6, max: 128 }).withMessage('Password must be 6-128 characters'),
  body('phone').customSanitizer(normalizePhone).matches(PHONE_PATTERN).withMessage('Please enter a valid phone number'),
  body('profileImage').optional().isString().withMessage('Profile image must be a string'),
  body('role').optional().isIn(['owner', 'tenant']).withMessage('Invalid role')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      gmail_convert_googlemaildotcom: false,
    })
    .withMessage('Please enter a valid email'),
  body('password').isString().notEmpty().withMessage('Password is required')
];

const updateProfileValidation = [
  body('name').optional().isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('phone').optional().customSanitizer(normalizePhone).matches(PHONE_PATTERN).withMessage('Please enter a valid phone number'),
  // Accept any non-empty string to allow base64 data URLs or hosted URLs
  body('profileImage').optional().isString().withMessage('Profile image must be a string')
];

// Routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/logout', logout);
router.get('/me', authenticateToken, getCurrentUser);
router.put('/me', authenticateToken, updateProfileValidation, updateCurrentUser);
router.delete('/me', authenticateToken, deleteCurrentUser);

export default router;
