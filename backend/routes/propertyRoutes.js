import express from 'express';
import { body } from 'express-validator';
import {
  getProperties,
  getProperty,
  getPropertyByPropertyId,
  createProperty,
  updateProperty,
  deleteProperty,
  getPropertiesByOwner,
  getTopRatedProperties,
  getSuggestedProperties
} from '../controllers/propertyController.js';
import { authenticateToken, authorize, checkOwnership } from '../middleware/auth.js';
import { registerObjectIdParams } from '../utils/request.js';
import Property from '../models/Property.js';

const router = express.Router();

registerObjectIdParams(router, ['id', 'ownerId']);

const PROPERTY_TYPES = Property.schema.path('type').enumValues;
const AVAILABILITY_STATUSES = Property.schema.path('availabilityStatus').enumValues;
const MAX_IMAGES = 10;
const MAX_IMAGE_LENGTH = 3_000_000; // ~2.2 MB image once base64-encoded
const MAX_TOTAL_IMAGES_LENGTH = 14_000_000;

const isImageReference = (value) =>
  typeof value === 'string' &&
  value.length <= MAX_IMAGE_LENGTH &&
  (/^https?:\/\//i.test(value) || /^data:image\/[a-z0-9.+-]+;base64,/i.test(value));

// On create every required field must be present; on update fields are optional
const propertyValidation = (isUpdate) => {
  const field = (name) => (isUpdate ? body(name).optional() : body(name));
  return [
    field('title').isString().trim().isLength({ min: 3, max: 120 }).withMessage('Title must be 3-120 characters'),
    field('description').isString().trim().isLength({ min: 10, max: 5000 }).withMessage('Description must be 10-5000 characters'),
    field('location').isString().trim().notEmpty().withMessage('Location is required'),
    field('price').isFloat({ min: 0 }).withMessage('Price must be a positive number').toFloat(),
    body('latitude').optional({ values: 'null' }).isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude').toFloat(),
    body('longitude').optional({ values: 'null' }).isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude').toFloat(),
    body('bedrooms').optional().isInt({ min: 0, max: 50 }).withMessage('Bedrooms must be 0-50').toInt(),
    body('bathrooms').optional().isInt({ min: 0, max: 50 }).withMessage('Bathrooms must be 0-50').toInt(),
    body('size').optional().isFloat({ min: 0 }).withMessage('Size must be a positive number').toFloat(),
    body('type').optional().isIn(PROPERTY_TYPES).withMessage(`Type must be one of: ${PROPERTY_TYPES.join(', ')}`),
    body('availabilityStatus').optional().isIn(AVAILABILITY_STATUSES).withMessage('Invalid availability status'),
    field('images')
      .isArray({ min: 1, max: MAX_IMAGES }).withMessage(`Provide 1-${MAX_IMAGES} images`)
      .custom((images) => images.every(isImageReference)).withMessage('Each image must be an http(s) URL or an image under ~2 MB')
      // MongoDB documents are capped at 16 MB, so leave room for the other fields
      .custom((images) => images.reduce((sum, img) => sum + img.length, 0) <= MAX_TOTAL_IMAGES_LENGTH)
      .withMessage('Images are too large in total; use fewer or smaller images'),
    body('amenities').optional().isArray({ max: 50 }).withMessage('Amenities must be a list')
      .custom((items) => items.every((a) => typeof a === 'string' && a.length <= 100)).withMessage('Each amenity must be short text')
  ];
};

// Routes
router.get('/', getProperties);
router.get('/top-rated', getTopRatedProperties);
router.get('/suggested', authenticateToken, getSuggestedProperties);
router.get('/owner/:ownerId', getPropertiesByOwner);
router.get('/property-id/:propertyId', getPropertyByPropertyId);
router.get('/:id', getProperty);

router.post('/',
  authenticateToken,
  authorize('owner', 'admin'),
  propertyValidation(false),
  createProperty
);

router.put('/:id',
  authenticateToken,
  authorize('owner', 'admin'),
  checkOwnership(Property),
  propertyValidation(true),
  updateProperty
);

router.delete('/:id',
  authenticateToken,
  authorize('owner', 'admin'),
  checkOwnership(Property),
  deleteProperty
);

export default router;
