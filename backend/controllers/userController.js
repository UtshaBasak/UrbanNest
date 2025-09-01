import User from '../models/User.js';
import Property from '../models/Property.js';
import Booking from '../models/Booking.js';
import Transaction from '../models/Transaction.js';
import Review from '../models/Review.js';
import Notification from '../models/Notification.js';
import UserRating from '../models/UserRating.js';
import mongoose from 'mongoose';

// @desc Get all users (Admin only)
// @route GET /api/users
// @access Private (Admin)
export const getUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 20, search } = req.query;
    const query = { isActive: true };

    if (role) query.role = role;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    // Attach rating summaries (owner/tenant) without altering existing client contract
    const userIds = users.map(u => u._id);
    let summaries = [];
    if (userIds.length) {
      summaries = await UserRating.aggregate([
        { $match: { ratee: { $in: userIds } } },
        { $group: { _id: { ratee: '$ratee', context: '$context' }, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
      ]);
    }
    const map = new Map();
    for (const s of summaries) {
      const key = s._id.ratee.toString();
      const prev = map.get(key) || {};
      if (s._id.context === 'owner') {
        prev.avgOwner = s.avg; prev.countOwner = s.count;
      } else if (s._id.context === 'tenant') {
        prev.avgTenant = s.avg; prev.countTenant = s.count;
      }
      map.set(key, prev);
    }
    const usersWithRatings = users.map(u => {
      const r = map.get(u._id.toString()) || {};
      return {
        ...u.toObject(),
        avgRatingOwner: r.avgOwner || 0,
        ratingCountOwner: r.countOwner || 0,
        avgRatingTenant: r.avgTenant || 0,
        ratingCountTenant: r.countTenant || 0,
      };
    });

    res.json({
      data: {
        users: usersWithRatings,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
          limit: Number(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error while fetching users' });
  }
};

// @desc Get current user's favourites with populated details
// @route GET /api/users/me/favourites
// @access Private (Tenant)
export const getMyFavourites = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'tenant') {
      return res.status(403).json({ message: 'Only tenants can access favourites' });
    }
    const user = await User.findById(req.user._id).select('favourites');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ownerIds = user.favourites.filter(f => f.itemType === 'owner').map(f => f.itemId);
    const propertyIds = user.favourites.filter(f => f.itemType === 'property').map(f => f.itemId);

    const [owners, properties] = await Promise.all([
      ownerIds.length ? User.find({ _id: { $in: ownerIds }, isActive: true }).select('name profileImage role') : [],
      propertyIds.length ? Property.find({ _id: { $in: propertyIds }, isActive: true }).select('title images price location availabilityStatus bedrooms bathrooms size') : []
    ]);

    // Map by id for quick lookup
    const ownersMap = new Map(owners.map(o => [o._id.toString(), o]));
    const propertiesMap = new Map(properties.map(p => [p._id.toString(), p]));

    const result = user.favourites.map(f => {
      const id = f.itemId.toString();
      const details = f.itemType === 'owner' ? ownersMap.get(id) : propertiesMap.get(id);
      return { ...f.toObject(), details };
    }).filter(item => !!item.details);

    res.json({ data: { favourites: result } });
  } catch (error) {
    console.error('getMyFavourites error:', error);
    res.status(500).json({ message: 'Server error while fetching favourites' });
  }
};

// @desc Add an item to current user's favourites
// @route POST /api/users/me/favourites
// @access Private (Tenant)
export const addFavourite = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'tenant') {
      return res.status(403).json({ message: 'Only tenants can add favourites' });
    }
    const { itemId, itemType } = req.body;
    if (!itemId || !itemType || !['owner', 'property'].includes(itemType)) {
      return res.status(400).json({ message: 'itemId and valid itemType are required' });
    }

    const user = await User.findById(req.user._id).select('favourites');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const exists = user.favourites.some(f => f.itemType === itemType && String(f.itemId) === String(itemId));
    if (!exists) {
      user.favourites.push({ itemId, itemType });
      await user.save();
    }

    res.status(201).json({ message: 'Added to favourites', data: { favourites: user.favourites } });
  } catch (error) {
    console.error('addFavourite error:', error);
    res.status(500).json({ message: 'Server error while adding favourite' });
  }
};

// @desc Remove an item from current user's favourites
// @route DELETE /api/users/me/favourites/:itemType/:itemId
// @access Private (Tenant)
export const removeFavourite = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'tenant') {
      return res.status(403).json({ message: 'Only tenants can remove favourites' });
    }
    const { itemType, itemId } = req.params;
    if (!['owner', 'property'].includes(itemType)) {
      return res.status(400).json({ message: 'Invalid itemType' });
    }
    const user = await User.findById(req.user._id).select('favourites');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const before = user.favourites.length;
    user.favourites = user.favourites.filter(f => !(f.itemType === itemType && String(f.itemId) === String(itemId)));
    if (user.favourites.length !== before) {
      await user.save();
    }

    res.json({ message: 'Removed from favourites', data: { favourites: user.favourites } });
  } catch (error) {
    console.error('removeFavourite error:', error);
    res.status(500).json({ message: 'Server error while removing favourite' });
  }
};

// @desc Delete a user (self or admin). If owner, cascade delete related data
// @route DELETE /api/users/:id
// @access Private (Self or Admin)
export const deleteUser = async (req, res) => {
  try {
    const targetId = req.params.id;
    const isSelf = req.user && (req.user.id === targetId || String(req.user._id) === String(targetId));
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const user = await User.findById(targetId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      // Delete ratings authored by or targeting this user
      await UserRating.deleteMany({ $or: [{ ratee: user._id }, { rater: user._id }] }).session(session);

      if (user.role === 'owner') {
        const properties = await Property.find({ owner: user._id }).session(session).select('_id');
        const propIds = properties.map(p => p._id);
        if (propIds.length) {
          await Booking.deleteMany({ property: { $in: propIds } }).session(session);
          await Transaction.deleteMany({ property: { $in: propIds } }).session(session);
          await Review.deleteMany({ property: { $in: propIds } }).session(session);
          await Notification.deleteMany({ $or: [ { property: { $in: propIds } }, { recipient: user._id } ] }).session(session);
          await Property.deleteMany({ _id: { $in: propIds } }).session(session);
        }
      } else {
        // Clean notifications addressed to this user
        await Notification.deleteMany({ recipient: user._id }).session(session);
      }

      await User.deleteOne({ _id: user._id }).session(session);
    });
    session.endSession();

    res.json({ message: 'User and related data deleted successfully', data: { id: targetId } });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error while deleting user' });
  }
};

// @desc Get single user
// @route GET /api/users/:id
// @access Public
export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user || !user.isActive) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's properties if they are an owner
    let properties = [];
    if (user.role === 'owner') {
      properties = await Property.find({ 
        owner: user._id, 
        isActive: true 
      }).sort({ createdAt: -1 }).limit(6);
    }

    // Rating summary for profile view
    const groups = await UserRating.aggregate([
      { $match: { ratee: user._id } },
      { $group: { _id: '$context', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    const summary = { owner: { avg: 0, count: 0 }, tenant: { avg: 0, count: 0 } };
    for (const g of groups) {
      if (g._id === 'owner') summary.owner = { avg: g.avg || 0, count: g.count || 0 };
      if (g._id === 'tenant') summary.tenant = { avg: g.avg || 0, count: g.count || 0 };
    }

    // Tenant activity: counts for bookings and reviews authored by this user
    let tenantActivity = undefined;
    if (user.role === 'tenant') {
      const [bookingsCount, reviewsCount] = await Promise.all([
        Booking.countDocuments({ tenant: user._id }),
        Review.countDocuments({ tenant: user._id })
      ]);
      tenantActivity = { bookingsCount, reviewsCount };
    }

    res.json({
      data: {
        user,
        properties,
        ratingSummary: summary,
        tenantActivity
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error while fetching user' });
  }
};

// @desc Search users
// @route GET /api/users/search
// @access Public
export const searchUsers = async (req, res) => {
  try {
    const { q, role } = req.query;

    if (!q || q.length < 2) {
      return res.json({ data: { users: [] } });
    }

    const query = {
      isActive: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ]
    };

    if (role) query.role = role;

    const users = await User.find(query)
      .select('name email role profileImage')
      .limit(10);

    res.json({ data: { users } });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error while searching users' });
  }
};

// @desc Check if current user (owner) can view a tenant's contact
// @route GET /api/users/:id/can-view-contact
// @access Private
export const canViewTenantContact = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const requester = req.user;
    if (!requester) return res.status(401).json({ message: 'Unauthorized' });

    const tenant = await User.findById(targetUserId).select('_id role');
    if (!tenant) return res.status(404).json({ message: 'User not found' });

    // Self always allowed
    if (String(requester._id) === String(targetUserId)) {
      return res.json({ data: { canView: true } });
    }

    // Only owners can view tenant contact, and only if tenant completed a booking on owner's property
    if (tenant.role !== 'tenant' || requester.role !== 'owner') {
      return res.json({ data: { canView: false } });
    }

    const match = await Booking.findOne({
      tenant: tenant._id,
      status: 'completed',
    }).populate({ path: 'property', select: 'owner', match: { owner: requester._id } });

    const canView = !!(match && match.property);
    return res.json({ data: { canView } });
  } catch (error) {
    console.error('canViewTenantContact error:', error);
    res.status(500).json({ message: 'Server error while checking contact visibility' });
  }
};

// @desc Update user status (Admin only)
// @route PUT /api/users/:id/status
// @access Private (Admin)
export const updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive
        }
      }
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'Server error while updating user status' });
  }
};