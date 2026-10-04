import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import Review from '../models/Review.js';
import Property from '../models/Property.js';
import Booking from '../models/Booking.js';
import { parsePagination, buildPagination } from '../utils/request.js';

// A tenant may review a property once their approved or completed stay has started
const hasEligibleStay = (tenantId, propertyId) => Booking.exists({
  tenant: tenantId,
  property: propertyId,
  status: { $in: ['approved', 'completed'] },
  startDate: { $lte: new Date() }
});

// @desc Create review
// @route POST /api/reviews
// @access Private (Tenant)
export const createReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { property: propertyId, rating, comment } = req.body;
    if (typeof propertyId !== 'string') {
      return res.status(400).json({ message: 'Invalid property ID' });
    }

    // Check if property exists
    const property = await Property.findOne({ _id: propertyId, isActive: true });
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    if (!(await hasEligibleStay(req.user._id, propertyId))) {
      return res.status(400).json({
        message: 'You can only review properties where your approved booking has started'
      });
    }

    // Check if user already reviewed this property
    const existingReview = await Review.findOne({
      tenant: req.user._id,
      property: propertyId
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this property' });
    }

    const review = new Review({
      tenant: req.user._id,
      property: propertyId,
      rating,
      comment
    });

    await review.save();

    const populatedReview = await Review.findById(review._id)
      .populate('tenant', 'name profileImage')
      .populate('property', 'title');

    res.status(201).json({
      message: 'Review created successfully',
      data: { review: populatedReview }
    });

  } catch (error) {
    // Unique index on tenant+property catches concurrent duplicate submissions
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'You have already reviewed this property' });
    }
    console.error('Create review error:', error);
    res.status(500).json({ message: 'Server error while creating review' });
  }
};

// @desc Check if current user can review a property (tenant with approved booking)
// @route GET /api/reviews/can-review?propertyId=
// @access Private (Tenant)
export const canReviewCheck = async (req, res) => {
  try {
    const { propertyId } = req.query;
    if (typeof propertyId !== 'string' || !mongoose.isValidObjectId(propertyId)) {
      return res.status(400).json({ message: 'A valid propertyId is required' });
    }
    const [eligible, alreadyReviewed] = await Promise.all([
      hasEligibleStay(req.user._id, propertyId),
      Review.exists({ tenant: req.user._id, property: propertyId })
    ]);
    return res.json({ data: { canReview: !!eligible && !alreadyReviewed, alreadyReviewed: !!alreadyReviewed } });
  } catch (error) {
    console.error('canReviewCheck error:', error);
    res.status(500).json({ message: 'Server error while checking review permission' });
  }
};

// @desc Get reviews for a property
// @route GET /api/reviews/property/:propertyId
// @access Public
export const getPropertyReviews = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10 });

    const reviews = await Review.find({
      property: propertyId,
      isPublic: true
    })
      .populate('tenant', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Review.countDocuments({
      property: propertyId,
      isPublic: true
    });

    // Calculate average rating
    const ratingStats = await Review.aggregate([
      { $match: { property: new mongoose.Types.ObjectId(propertyId), isPublic: true } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    const { averageRating = 0, totalReviews = 0 } = ratingStats[0] || {};
    const stats = { averageRating, totalReviews };

    res.json({
      data: {
        reviews,
        stats,
        pagination: buildPagination(total, page, limit)
      }
    });

  } catch (error) {
    console.error('Get property reviews error:', error);
    res.status(500).json({ message: 'Server error while fetching reviews' });
  }
};

// @desc Get user's reviews
// @route GET /api/reviews/my
// @access Private
export const getMyReviews = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10 });

    const reviews = await Review.find({ tenant: req.user._id })
      .populate('property', 'title images location')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Review.countDocuments({ tenant: req.user._id });

    res.json({
      data: {
        reviews,
        pagination: buildPagination(total, page, limit)
      }
    });

  } catch (error) {
    console.error('Get my reviews error:', error);
    res.status(500).json({ message: 'Server error while fetching reviews' });
  }
};

// @desc Get reviews for owner's properties
// @route GET /api/reviews/my-properties
// @access Private (Owner)
export const getMyPropertiesReviews = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10 });

    // First, get all properties owned by the current user
    const propertyIds = await Property.find({ owner: req.user._id }).distinct('_id');

    // Then get all reviews for these properties
    const reviews = await Review.find({ property: { $in: propertyIds } })
      .populate('property', 'title images location')
      .populate('tenant', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Review.countDocuments({ property: { $in: propertyIds } });

    res.json({
      message: 'Reviews for owner properties fetched successfully',
      data: {
        reviews,
        pagination: buildPagination(total, page, limit)
      }
    });

  } catch (error) {
    console.error('Get my properties reviews error:', error);
    res.status(500).json({ message: 'Server error while fetching property reviews' });
  }
};

// @desc Update review
// @route PUT /api/reviews/:id
// @access Private (Review owner)
export const updateReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user owns the review
    if (review.tenant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { rating, comment } = req.body;

    review.rating = rating;
    review.comment = comment;
    await review.save();

    const updatedReview = await Review.findById(review._id)
      .populate('tenant', 'name profileImage')
      .populate('property', 'title');

    res.json({
      message: 'Review updated successfully',
      data: { review: updatedReview }
    });

  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ message: 'Server error while updating review' });
  }
};

// @desc Delete review
// @route DELETE /api/reviews/:id
// @access Private (Review owner, Admin)
export const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user owns the review or is admin
    if (req.user.role !== 'admin' &&
        review.tenant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Review.findByIdAndDelete(req.params.id);

    res.json({ message: 'Review deleted successfully' });

  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: 'Server error while deleting review' });
  }
};