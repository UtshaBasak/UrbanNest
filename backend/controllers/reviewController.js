import { validationResult } from 'express-validator';
import Review from '../models/Review.js';
import Property from '../models/Property.js';
import Booking from '../models/Booking.js';

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

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Check if user has a completed booking for this property
    const hasBooking = await Booking.findOne({
      tenant: req.user._id,
      property: propertyId,
      status: 'completed'
    });

    if (!hasBooking) {
      return res.status(400).json({ 
        message: 'You can only review properties you have booked and completed' 
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
    console.error('Create review error:', error);
    res.status(500).json({ message: 'Server error while creating review' });
  }
};

// @desc Check if current user can review a property (tenant with completed booking)
// @route GET /api/reviews/can-review?propertyId=
// @access Private (Tenant)
export const canReviewCheck = async (req, res) => {
  try {
    const { propertyId } = req.query;
    if (!propertyId) return res.status(400).json({ message: 'propertyId is required' });
    const hasBooking = await Booking.findOne({
      tenant: req.user._id,
      property: propertyId,
      status: 'completed'
    });
    return res.json({ data: { canReview: !!hasBooking } });
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
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ 
      property: propertyId, 
      isPublic: true 
    })
      .populate('tenant', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments({ 
      property: propertyId, 
      isPublic: true 
    });

    // Calculate average rating
    const ratingStats = await Review.aggregate([
      { $match: { property: propertyId, isPublic: true } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    const stats = ratingStats[0] || { averageRating: 0, totalReviews: 0 };

    res.json({
      data: {
        reviews,
        stats,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
          limit: Number(limit)
        }
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
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ tenant: req.user._id })
      .populate('property', 'title images location')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments({ tenant: req.user._id });

    res.json({
      data: {
        reviews,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
          limit: Number(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get my reviews error:', error);
    res.status(500).json({ message: 'Server error while fetching reviews' });
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