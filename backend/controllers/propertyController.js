import { validationResult } from 'express-validator';
import Property from '../models/Property.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';

// @desc Get all properties with filters
// @route GET /api/properties
// @access Public
export const getProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      minPrice,
      maxPrice,
      bedrooms,
      propertyType,
      availabilityStatus = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      lat,
      lng,
      radius = 10 // km
    } = req.query;

    const query = { isActive: true };

    // Price filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Other filters
    if (bedrooms) query.bedrooms = Number(bedrooms);
    if (propertyType) query.propertyType = propertyType;
    if (availabilityStatus) query.availabilityStatus = availabilityStatus;

    // Search in title and location
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Location-based search
    if (lat && lng) {
      const radiusInRad = radius / 6371; // Earth's radius in km
      query['coordinates.latitude'] = {
        $gte: Number(lat) - radiusInRad,
        $lte: Number(lat) + radiusInRad
      };
      query['coordinates.longitude'] = {
        $gte: Number(lng) - radiusInRad,
        $lte: Number(lng) + radiusInRad
      };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    let properties = await Property.find(query)
      .populate('owner', 'name email phone')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Attach currentTenant if active booking exists (start<=now<end and status approved or completed)
    // or if approved future booking exists
    const now = new Date();
    const propIds = properties.map(p => p._id);
    
    // First get active bookings
    const activeBookings = await Booking.find({
      property: { $in: propIds },
      startDate: { $lte: now },
      endDate: { $gt: now },
      status: { $in: ['approved', 'completed'] }
    }).populate('tenant', 'name');
    
    // Then get approved future bookings for properties without active bookings
    const propsWithActive = new Set(activeBookings.map(b => b.property.toString()));
    const propsWithoutActive = propIds.filter(id => !propsWithActive.has(id.toString()));
    
    const futureBookings = await Booking.find({
      property: { $in: propsWithoutActive },
      startDate: { $gt: now },
      status: 'approved'
    }).populate('tenant', 'name');
    
    // Group future bookings by property and get earliest for each
    const futureByProp = new Map();
    futureBookings.forEach(b => {
      const propId = b.property.toString();
      if (!futureByProp.has(propId) || b.startDate < futureByProp.get(propId).startDate) {
        futureByProp.set(propId, b);
      }
    });
    
    // Combine active and future bookings
    const allBookings = [...activeBookings, ...Array.from(futureByProp.values())];
    const byProp = new Map();
    allBookings.forEach(b => byProp.set(b.property.toString(), b));
    
    properties = properties.map(p => {
      const b = byProp.get(p._id.toString());
      const obj = p.toObject();
      if (b) obj.currentTenant = { id: b.tenant._id, name: b.tenant.name };
      return obj;
    });

    const total = await Property.countDocuments(query);

    res.json({
      data: {
        properties,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
          limit: Number(limit)
        }
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
    const { limit = 6, minReviews = 1 } = req.query;

    const agg = await Review.aggregate([
      { $group: { _id: '$property', averageRating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } },
      { $match: { totalReviews: { $gte: Number(minReviews) } } },
      { $sort: { averageRating: -1, totalReviews: -1 } },
      { $limit: Number(limit) }
    ]);

    const ids = agg.map(a => a._id);
    const props = await Property.find({ _id: { $in: ids }, isActive: true })
      .populate('owner', 'name email phone')
      .lean();

    const map = new Map(agg.map(a => [String(a._id), a]));
    const properties = props.map(p => ({
      ...p,
      averageRating: map.get(String(p._id))?.averageRating || 0,
      totalReviews: map.get(String(p._id))?.totalReviews || 0
    }));

    properties.sort((a, b) => (b.averageRating - a.averageRating) || (b.totalReviews - a.totalReviews));

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
    const propertyDoc = await Property.findById(req.params.id)
      .populate('owner', 'name email phone profileImage');

    if (!propertyDoc) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Compute currentTenant for this property
    const now = new Date();
    let activeBooking = await Booking.findOne({
      property: propertyDoc._id,
      startDate: { $lte: now },
      endDate: { $gt: now },
      status: { $in: ['approved', 'completed'] }
    }).populate('tenant', 'name');

    // If no active booking, check for approved future booking
    if (!activeBooking) {
      activeBooking = await Booking.findOne({
        property: propertyDoc._id,
        startDate: { $gt: now },
        status: 'approved'
      }).sort({ startDate: 1 }).populate('tenant', 'name');
    }

    const property = propertyDoc.toObject();
    if (activeBooking) {
      property.currentTenant = { id: activeBooking.tenant._id, name: activeBooking.tenant.name };
    }

    res.json({
      data: {
        property
      }
    });

  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({ message: 'Server error while fetching property' });
  }
};

// @desc Create property
// @route POST /api/properties
// @access Private (Owner, Admin)
export const createProperty = async (req, res) => {
  try {
    // Relaxed validation: accept payload as-is; user verification is handled via auth middleware

    const propertyData = {
      ...req.body,
      owner: req.user._id
    };

    const property = new Property(propertyData);
    await property.save();

    const populatedProperty = await Property.findById(property._id)
      .populate('owner', 'name email phone');

    res.status(201).json({
      message: 'Property created successfully',
      data: {
        property: populatedProperty
      }
    });

  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({ message: 'Server error while creating property' });
  }
};

// @desc Update property
// @route PUT /api/properties/:id
// @access Private (Owner of property, Admin)
export const updateProperty = async (req, res) => {
  try {
    // Relaxed validation: accept payload updates as-is; user/role verification remains enforced

    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Check ownership (middleware handles this, but double-check)
    if (req.user.role !== 'admin' && property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updatedProperty = await Property.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('owner', 'name email phone');

    res.json({
      message: 'Property updated successfully',
      data: {
        property: updatedProperty
      }
    });

  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({ message: 'Server error while updating property' });
  }
};

// @desc Delete property
// @route DELETE /api/properties/:id
// @access Private (Owner of property, Admin)
export const deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Check ownership
    if (req.user.role !== 'admin' && property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Soft delete by setting isActive to false
    await Property.findByIdAndUpdate(req.params.id, { isActive: false });

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
    const { page = 1, limit = 12 } = req.query;

    const properties = await Property.find({ 
      owner: ownerId, 
      isActive: true 
    })
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Property.countDocuments({ 
      owner: ownerId, 
      isActive: true 
    });

    res.json({
      data: {
        properties,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
          limit: Number(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get properties by owner error:', error);
    res.status(500).json({ message: 'Server error while fetching owner properties' });
  }
};