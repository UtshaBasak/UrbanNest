import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import Property from '../models/Property.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import { toSearchRegex, parsePagination, buildPagination, handleKnownDbError } from '../utils/request.js';

// Fields owners may set when creating or editing a listing. Everything else
// (owner, propertyId, isActive, timestamps) is controlled by the server.
const EDITABLE_FIELDS = [
  'title', 'description', 'location', 'latitude', 'longitude', 'price',
  'bedrooms', 'bathrooms', 'size', 'area', 'type', 'propertyType',
  'images', 'amenities', 'availabilityStatus'
];
const SORTABLE_FIELDS = ['createdAt', 'price', 'bedrooms'];
const OWNER_FIELDS = 'name email phone profileImage';

const pickEditableFields = (body) => {
  const data = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  // Keep the legacy coordinates sub-document in sync with latitude/longitude
  if (data.latitude !== undefined || data.longitude !== undefined) {
    data.coordinates = { latitude: data.latitude, longitude: data.longitude };
  }
  return data;
};

const sendValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ message: 'Validation failed', errors: errors.array() });
  return true;
};

// Attach averageRating/totalReviews to a list of plain property objects
const withRatings = async (properties) => {
  if (!properties.length) return properties;
  const ratings = await Review.aggregate([
    { $match: { property: { $in: properties.map(p => p._id) } } },
    { $group: { _id: '$property', averageRating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } }
  ]);
  const ratingMap = new Map(ratings.map(r => [String(r._id), r]));
  return properties.map(p => ({
    ...p,
    averageRating: ratingMap.get(String(p._id))?.averageRating || 0,
    totalReviews: ratingMap.get(String(p._id))?.totalReviews || 0
  }));
};

// Tenant currently living in (or next booked into) each property
const findCurrentTenants = async (propertyIds) => {
  const now = new Date();
  const bookings = await Booking.find({
    property: { $in: propertyIds },
    $or: [
      { startDate: { $lte: now }, endDate: { $gt: now }, status: { $in: ['approved', 'completed'] } },
      { startDate: { $gt: now }, status: 'approved' }
    ]
  })
    .sort({ startDate: 1 })
    .populate('tenant', 'name');

  const byProperty = new Map();
  for (const b of bookings) {
    if (!b.tenant) continue;
    const key = b.property.toString();
    const isActive = b.startDate <= now;
    const existing = byProperty.get(key);
    // Prefer an active booking; otherwise keep the earliest future one
    if (!existing || (isActive && !existing.isActive)) {
      byProperty.set(key, { isActive, tenant: { id: b.tenant._id, name: b.tenant.name } });
    }
  }
  return byProperty;
};

// Full details for a single property document
const buildPropertyDetails = async (propertyDoc) => {
  const property = propertyDoc.toObject();
  const tenants = await findCurrentTenants([propertyDoc._id]);
  const current = tenants.get(propertyDoc._id.toString());
  if (current) property.currentTenant = current.tenant;
  const [rated] = await withRatings([property]);
  return rated;
};

// @desc Get suggested properties for a user based on favorites and bookings
// @route GET /api/properties/suggested
// @access Private
export const getSuggestedProperties = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('favourites');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const favPropertyIds = user.favourites
      .filter(fav => fav.itemType === 'property')
      .map(fav => fav.itemId.toString());
    const bookedPropertyIds = (await Booking.find({ tenant: userId }).distinct('property')).map(String);
    const activityPropertyIds = Array.from(new Set([...favPropertyIds, ...bookedPropertyIds]));

    let suggested = [];
    if (activityPropertyIds.length > 0) {
      const activityProps = await Property.find({ _id: { $in: activityPropertyIds } }).select('type location');
      const types = Array.from(new Set(activityProps.map(p => p.type).filter(Boolean)));
      const locations = Array.from(new Set(activityProps.map(p => p.location).filter(Boolean)));

      suggested = await Property.find({
        isActive: true,
        owner: { $ne: userId },
        _id: { $nin: activityPropertyIds },
        $or: [{ type: { $in: types } }, { location: { $in: locations } }]
      })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('owner', OWNER_FIELDS)
        .lean();
    }

    // Fill up with recent listings
    if (suggested.length < 8) {
      const more = await Property.find({
        isActive: true,
        owner: { $ne: userId },
        _id: { $nin: [...activityPropertyIds, ...suggested.map(p => p._id.toString())] }
      })
        .sort({ createdAt: -1 })
        .limit(8 - suggested.length)
        .populate('owner', OWNER_FIELDS)
        .lean();
      suggested = [...suggested, ...more];
    }

    res.json({ data: await withRatings(suggested) });
  } catch (error) {
    console.error('Get suggested properties error:', error);
    res.status(500).json({ message: 'Server error while fetching suggested properties' });
  }
};

// @desc Get all properties with filters
// @route GET /api/properties
// @access Public
export const getProperties = async (req, res) => {
  try {
    const { minPrice, maxPrice, bedrooms, propertyType, type, availabilityStatus, search, lat, lng } = req.query;
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12 });

    const query = { isActive: true };

    const min = Number(minPrice);
    const max = Number(maxPrice);
    if (minPrice !== undefined && minPrice !== '' && Number.isFinite(min)) query.price = { ...query.price, $gte: min };
    if (maxPrice !== undefined && maxPrice !== '' && Number.isFinite(max)) query.price = { ...query.price, $lte: max };

    const beds = Number(bedrooms);
    if (bedrooms !== undefined && bedrooms !== '' && Number.isFinite(beds)) query.bedrooms = beds;
    if (typeof propertyType === 'string' && propertyType) query.propertyType = propertyType;
    if (typeof type === 'string' && type) query.type = type;
    if (typeof availabilityStatus === 'string' && availabilityStatus) query.availabilityStatus = availabilityStatus;

    const searchRegex = toSearchRegex(search);
    if (searchRegex) {
      query.$or = [
        { title: searchRegex },
        { location: searchRegex },
        { description: searchRegex },
        { propertyId: searchRegex }
      ];
    }

    // Bounding-box search around lat/lng (radius in km)
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (Number.isFinite(latNum) && Number.isFinite(lngNum) && lat !== '' && lng !== '') {
      const radiusKm = Math.min(Math.max(Number(req.query.radius) || 10, 0.1), 500);
      const dLat = radiusKm / 111.32;
      const dLng = radiusKm / (111.32 * Math.max(Math.cos((latNum * Math.PI) / 180), 0.01));
      query.latitude = { $gte: latNum - dLat, $lte: latNum + dLat };
      query.longitude = { $gte: lngNum - dLng, $lte: lngNum + dLng };
    }

    const sortBy = SORTABLE_FIELDS.includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const [docs, total] = await Promise.all([
      Property.find(query)
        .populate('owner', OWNER_FIELDS)
        .sort({ [sortBy]: sortOrder, _id: sortOrder })
        .limit(limit)
        .skip(skip)
        .lean(),
      Property.countDocuments(query)
    ]);

    const tenants = await findCurrentTenants(docs.map(p => p._id));
    const properties = await withRatings(docs.map(p => {
      const current = tenants.get(p._id.toString());
      return current ? { ...p, currentTenant: current.tenant } : p;
    }));

    res.json({
      data: {
        properties,
        pagination: buildPagination(total, page, limit)
      }
    });

  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({ message: 'Server error while fetching properties' });
  }
};

// @desc Get top-rated properties (by average rating and review count)
// @route GET /api/properties/top-rated
// @access Public
export const getTopRatedProperties = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 6, 1), 50);
    const minReviews = Math.max(parseInt(req.query.minReviews, 10) || 1, 1);

    // Join active properties before limiting so deleted listings don't shorten the list
    const agg = await Review.aggregate([
      { $group: { _id: '$property', averageRating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } },
      { $match: { totalReviews: { $gte: minReviews } } },
      { $lookup: { from: Property.collection.name, localField: '_id', foreignField: '_id', as: 'property' } },
      { $match: { 'property.isActive': true } },
      { $sort: { averageRating: -1, totalReviews: -1 } },
      { $limit: limit },
      { $project: { averageRating: 1, totalReviews: 1 } }
    ]);

    const props = await Property.find({ _id: { $in: agg.map(a => a._id) }, isActive: true })
      .populate('owner', OWNER_FIELDS)
      .lean();

    const map = new Map(agg.map(a => [String(a._id), a]));
    const properties = props
      .map(p => ({
        ...p,
        averageRating: map.get(String(p._id))?.averageRating || 0,
        totalReviews: map.get(String(p._id))?.totalReviews || 0
      }))
      .sort((a, b) => (b.averageRating - a.averageRating) || (b.totalReviews - a.totalReviews));

    res.json({ data: { properties } });
  } catch (error) {
    console.error('getTopRatedProperties error:', error);
    res.status(500).json({ message: 'Server error while fetching top-rated properties' });
  }
};

// @desc Get single property
// @route GET /api/properties/:id
// @access Public
export const getProperty = async (req, res) => {
  try {
    const propertyDoc = await Property.findOne({ _id: req.params.id, isActive: true })
      .populate('owner', OWNER_FIELDS);

    if (!propertyDoc) {
      return res.status(404).json({ message: 'Property not found' });
    }

    res.json({ data: { property: await buildPropertyDetails(propertyDoc) } });

  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({ message: 'Server error while fetching property' });
  }
};

// @desc Get property by propertyId
// @route GET /api/properties/property-id/:propertyId
// @access Public
export const getPropertyByPropertyId = async (req, res) => {
  try {
    const propertyDoc = await Property.findOne({ propertyId: String(req.params.propertyId).toUpperCase(), isActive: true })
      .populate('owner', OWNER_FIELDS);

    if (!propertyDoc) {
      return res.status(404).json({ message: 'Property not found' });
    }

    res.json({ data: { property: await buildPropertyDetails(propertyDoc) } });

  } catch (error) {
    console.error('Get property by propertyId error:', error);
    res.status(500).json({ message: 'Server error while fetching property' });
  }
};

// Generate a unique 8-character alphanumeric public ID
const generateUniquePropertyId = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (;;) {
    let propertyId = '';
    for (let i = 0; i < 8; i++) {
      propertyId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (!(await Property.exists({ propertyId }))) return propertyId;
  }
};

// @desc Create property
// @route POST /api/properties
// @access Private (Owner, Admin)
export const createProperty = async (req, res) => {
  try {
    if (sendValidationErrors(req, res)) return;

    const property = await Property.create({
      ...pickEditableFields(req.body),
      propertyId: await generateUniquePropertyId(),
      owner: req.user._id
    });

    const populatedProperty = await Property.findById(property._id)
      .populate('owner', OWNER_FIELDS);

    res.status(201).json({
      message: 'Property created successfully',
      data: { property: populatedProperty }
    });

  } catch (error) {
    if (handleKnownDbError(res, error)) return;
    console.error('Create property error:', error);
    res.status(500).json({ message: 'Server error while creating property' });
  }
};

// @desc Update property
// @route PUT /api/properties/:id
// @access Private (Owner of property, Admin) - ownership checked by middleware
export const updateProperty = async (req, res) => {
  try {
    if (sendValidationErrors(req, res)) return;

    const updatedProperty = await Property.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { $set: pickEditableFields(req.body) },
      { returnDocument: 'after', runValidators: true }
    ).populate('owner', OWNER_FIELDS);

    if (!updatedProperty) {
      return res.status(404).json({ message: 'Property not found' });
    }

    res.json({
      message: 'Property updated successfully',
      data: { property: updatedProperty }
    });

  } catch (error) {
    if (handleKnownDbError(res, error)) return;
    console.error('Update property error:', error);
    res.status(500).json({ message: 'Server error while updating property' });
  }
};

// @desc Delete property (soft delete; bookings and reviews are kept for history)
// @route DELETE /api/properties/:id
// @access Private (Owner of property, Admin) - ownership checked by middleware
export const deleteProperty = async (req, res) => {
  try {
    const activeBooking = await Booking.exists({
      property: req.params.id,
      status: 'approved',
      endDate: { $gt: new Date() }
    });
    if (activeBooking) {
      return res.status(409).json({ message: 'This property has an active or upcoming approved booking. End or cancel it before deleting the listing.' });
    }

    await Property.updateOne({ _id: req.params.id }, { $set: { isActive: false } });

    // Pending requests for a removed listing can no longer be accepted
    await Booking.updateMany(
      { property: req.params.id, status: 'pending' },
      { $set: { status: 'rejected', rejectionReason: 'The listing was removed by the owner' } }
    );

    res.json({ message: 'Property deleted successfully' });

  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({ message: 'Server error while deleting property' });
  }
};

// @desc Get properties by owner
// @route GET /api/properties/owner/:ownerId
// @access Public
export const getPropertiesByOwner = async (req, res) => {
  try {
    const { ownerId } = req.params;
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12 });
    const query = { owner: new mongoose.Types.ObjectId(ownerId), isActive: true };

    const [docs, total] = await Promise.all([
      Property.find(query)
        .populate('owner', OWNER_FIELDS)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      Property.countDocuments(query)
    ]);

    res.json({
      data: {
        properties: await withRatings(docs),
        pagination: buildPagination(total, page, limit)
      }
    });

  } catch (error) {
    console.error('Get properties by owner error:', error);
    res.status(500).json({ message: 'Server error while fetching owner properties' });
  }
};
