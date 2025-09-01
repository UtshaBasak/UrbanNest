import express from 'express';
import { body } from 'express-validator';
import {
  getProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  getPropertiesByOwner,
  getTopRatedProperties
} from '../controllers/propertyController.js';
import { authenticateToken, authorize, checkOwnership } from '../middleware/auth.js';
import Property from '../models/Property.js';

const router = express.Router();

// Validation rules
const propertyValidation = [
  body('title').trim().isLength({ min: 5 }).withMessage('Title must be at least 5 characters'),
  body('description').trim().isLength({ min: 20 }).withMessage('Description must be at least 20 characters'),
  body('location').notEmpty().withMessage('Location is required'),
  body('coordinates.latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('coordinates.longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('price').isNumeric().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('bedrooms').isInt({ min: 1, max: 20 }).withMessage('Bedrooms must be between 1 and 20'),
  body('bathrooms').isInt({ min: 1, max: 20 }).withMessage('Bathrooms must be between 1 and 20'),
  body('area').isNumeric().isFloat({ min: 1 }).withMessage('Area must be a positive number'),
  body('propertyType').isIn(['apartment', 'house', 'condo', 'villa', 'studio']).withMessage('Invalid property type'),
  body('images').isArray({ min: 1 }).withMessage('At least one image is required'),
  body('images.*').isURL().withMessage('Images must be valid URLs'),
  body('amenities').optional().isArray().withMessage('Amenities must be an array')
];

// Routes
router.get('/', getProperties);
router.get('/top-rated', getTopRatedProperties);
router.get('/owner/:ownerId', getPropertiesByOwner);
router.get('/:id', getProperty);

router.post('/', 
  authenticateToken, 
  authorize('owner', 'admin'), 
  propertyValidation, 
  createProperty
);

router.put('/:id', 
  authenticateToken, 
  authorize('owner', 'admin'),
  checkOwnership(Property),
  propertyValidation, 
  updateProperty
);

router.delete('/:id', 
  authenticateToken, 
  authorize('owner', 'admin'),
  checkOwnership(Property),
  deleteProperty
);

export default router;