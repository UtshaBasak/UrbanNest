import User from '../models/User.js';
import Property from '../models/Property.js';
import UserRating from '../models/UserRating.js';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import { deleteUserCascade, deletePropertiesCascade } from '../utils/cascadeDelete.js';
import { runInTransaction } from '../utils/transaction.js';
import { toSearchRegex, parsePagination, buildPagination } from '../utils/request.js';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Admin user lists include deactivated accounts so they can be found and reactivated
const userSearchQuery = (role, search) => {
  const query = { role };
  const regex = toSearchRegex(search);
  if (regex) {
    query.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }
  return query;
};

// @desc Get all owners with search functionality
// @route GET /api/admin/owners
// @access Private (Admin only)
export const getOwners = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const query = userSearchQuery('owner', req.query.search);

    const owners = await User.find(query)
      .select('-password -favourites')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await User.countDocuments(query);

    // Get rating summaries for owners
    const ownerIds = owners.map(o => o._id);
    let ratings = [];
    if (ownerIds.length) {
      ratings = await UserRating.aggregate([
        { $match: { ratee: { $in: ownerIds }, context: 'owner' } },
        { $group: { _id: '$ratee', avgRating: { $avg: '$rating' }, ratingCount: { $sum: 1 } } }
      ]);
    }

    const ratingsMap = new Map(ratings.map(r => [r._id.toString(), r]));
    
    // Get property counts for each owner
    const propertyCounts = await Property.aggregate([
      { $match: { owner: { $in: ownerIds }, isActive: true } },
      { $group: { _id: '$owner', propertyCount: { $sum: 1 } } }
    ]);
    
    const propertyCountsMap = new Map(propertyCounts.map(p => [p._id.toString(), p.propertyCount]));

    const ownersWithDetails = owners.map(owner => {
      const rating = ratingsMap.get(owner._id.toString()) || {};
      return {
        ...owner.toObject(),
        avgRating: rating.avgRating || 0,
        ratingCount: rating.ratingCount || 0,
        propertyCount: propertyCountsMap.get(owner._id.toString()) || 0
      };
    });

    res.json({
      data: {
        owners: ownersWithDetails,
        pagination: buildPagination(total, page, limit)
      }
    });

  } catch (error) {
    console.error('Get owners error:', error);
    res.status(500).json({ message: 'Server error while fetching owners' });
  }
};

// @desc Get all tenants with search functionality
// @route GET /api/admin/tenants
// @access Private (Admin only)
export const getTenants = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const query = userSearchQuery('tenant', req.query.search);

    const tenants = await User.find(query)
      .select('-password -favourites')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await User.countDocuments(query);

    // Get rating summaries for tenants
    const tenantIds = tenants.map(t => t._id);
    let ratings = [];
    if (tenantIds.length) {
      ratings = await UserRating.aggregate([
        { $match: { ratee: { $in: tenantIds }, context: 'tenant' } },
        { $group: { _id: '$ratee', avgRating: { $avg: '$rating' }, ratingCount: { $sum: 1 } } }
      ]);
    }

    const ratingsMap = new Map(ratings.map(r => [r._id.toString(), r]));

    const tenantsWithDetails = tenants.map(tenant => {
      const rating = ratingsMap.get(tenant._id.toString()) || {};
      return {
        ...tenant.toObject(),
        avgRating: rating.avgRating || 0,
        ratingCount: rating.ratingCount || 0
      };
    });

    res.json({
      data: {
        tenants: tenantsWithDetails,
        pagination: buildPagination(total, page, limit)
      }
    });

  } catch (error) {
    console.error('Get tenants error:', error);
    res.status(500).json({ message: 'Server error while fetching tenants' });
  }
};

// @desc Get all properties with search functionality
// @route GET /api/admin/properties
// @access Private (Admin only)
export const getProperties = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const query = { isActive: true };

    const regex = toSearchRegex(req.query.search);
    if (regex) {
      // location is a plain string on the Property model
      query.$or = [
        { title: regex },
        { description: regex },
        { location: regex },
        { propertyId: regex },
        { type: regex },
        { availabilityStatus: regex }
      ];
    }

    const properties = await Property.find(query)
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Property.countDocuments(query);

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

// @desc Delete a user (admin only)
// @route DELETE /api/admin/users/:id
// @access Private (Admin only)
export const deleteUserById = async (req, res) => {
  try {
    await runInTransaction(async (session) => {
      const user = await User.findById(req.params.id).session(session);
      if (!user) throw new HttpError(404, 'User not found');
      if (String(req.user._id) === String(user._id)) throw new HttpError(403, 'Cannot delete your own admin account');
      if (user.role === 'admin') throw new HttpError(403, 'Cannot delete admin accounts');
      await deleteUserCascade(user, session);
    });

    res.json({ message: 'User and related data deleted successfully' });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error during user deletion' });
  }
};

// @desc Delete a property (admin only)
// @route DELETE /api/admin/properties/:id
// @access Private (Admin only)
export const deletePropertyById = async (req, res) => {
  try {
    await runInTransaction(async (session) => {
      const property = await Property.findById(req.params.id).session(session);
      if (!property) throw new HttpError(404, 'Property not found');
      await deletePropertiesCascade([property._id], session);
    });

    res.json({ message: 'Property and related data deleted successfully' });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('Delete property error:', error);
    res.status(500).json({ message: 'Server error during property deletion' });
  }
};

// @desc Get admin dashboard statistics
// @route GET /api/admin/stats
// @access Private (Admin only)
export const getAdminStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalOwners,
      totalTenants,
      totalProperties,
      totalBookings,
      propertyReviews,
      userRatings
    ] = await Promise.all([
      User.countDocuments({ isActive: true, role: { $ne: 'admin' } }),
      User.countDocuments({ role: 'owner', isActive: true }),
      User.countDocuments({ role: 'tenant', isActive: true }),
      Property.countDocuments({ isActive: true }),
      Booking.countDocuments({ status: 'approved' }),
      Review.countDocuments(),
      UserRating.countDocuments()
    ]);

    const totalReviews = propertyReviews + userRatings;

    res.json({
      data: {
        stats: {
          totalUsers,
          totalOwners,
          totalTenants,
          totalProperties,
          totalBookings,
          totalReviews
        }
      }
    });

  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ message: 'Server error while fetching admin statistics' });
  }
};

// @desc Get all reviews (property reviews and user ratings)
// @route GET /api/admin/reviews
// @access Private (Admin only)
export const getAllReviews = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query, { defaultLimit: 10 });
    const regex = toSearchRegex(req.query.search);

    // Search by comment, by reviewer/target name or email, or by property title
    let propertyReviewQuery = {};
    let userRatingQuery = {};
    if (regex) {
      const [userIds, propertyIds] = await Promise.all([
        User.find({ $or: [{ name: regex }, { email: regex }] }).distinct('_id'),
        Property.find({ title: regex }).distinct('_id')
      ]);
      propertyReviewQuery = { $or: [{ comment: regex }, { tenant: { $in: userIds } }, { property: { $in: propertyIds } }] };
      userRatingQuery = { $or: [{ comment: regex }, { rater: { $in: userIds } }, { ratee: { $in: userIds } }] };
    }

    // Both collections are merged and sorted by date, so fetch enough of each
    // to cover every item up to the end of the requested page, then slice.
    const windowSize = page * limit;
    const [propertyReviews, userRatings, totalPropertyReviews, totalUserRatings] = await Promise.all([
      Review.find(propertyReviewQuery)
        .populate('tenant', 'name email')
        .populate('property', 'title location')
        .sort({ createdAt: -1 })
        .limit(windowSize)
        .lean(),
      UserRating.find(userRatingQuery)
        .populate('ratee', 'name email')
        .populate('rater', 'name email')
        .sort({ createdAt: -1 })
        .limit(windowSize)
        .lean(),
      Review.countDocuments(propertyReviewQuery),
      UserRating.countDocuments(userRatingQuery)
    ]);

    const allReviews = [
      ...propertyReviews.map(review => ({
        _id: review._id,
        type: 'property',
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        reviewer: review.tenant,
        target: review.property,
        targetType: 'Property'
      })),
      ...userRatings.map(rating => ({
        _id: rating._id,
        type: 'user',
        rating: rating.rating,
        comment: rating.comment,
        createdAt: rating.createdAt,
        context: rating.context,
        reviewer: rating.rater,
        target: rating.ratee,
        targetType: rating.context === 'owner' ? 'Owner' : 'Tenant'
      }))
    ].sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));

    const total = totalPropertyReviews + totalUserRatings;

    res.json({
      data: {
        reviews: allReviews.slice((page - 1) * limit, page * limit),
        pagination: buildPagination(total, page, limit)
      }
    });

  } catch (error) {
    console.error('Get all reviews error:', error);
    res.status(500).json({ message: 'Server error while fetching reviews' });
  }
};

// @desc Delete review (property review or user rating)
// @route DELETE /api/admin/reviews/:id
// @access Private (Admin only)
export const deleteReviewById = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // 'property' or 'user'

    let deletedReview;

    if (type === 'property') {
      deletedReview = await Review.findByIdAndDelete(id);
    } else if (type === 'user') {
      deletedReview = await UserRating.findByIdAndDelete(id);
    } else {
      // Try to find in both collections if type not specified
      deletedReview = await Review.findByIdAndDelete(id);
      if (!deletedReview) {
        deletedReview = await UserRating.findByIdAndDelete(id);
      }
    }

    if (!deletedReview) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json({
      message: 'Review deleted successfully',
      data: { id }
    });

  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: 'Server error while deleting review' });
  }
};
