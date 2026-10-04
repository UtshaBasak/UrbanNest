import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Property from '../models/Property.js';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import UserRating from '../models/UserRating.js';
import { deleteUserCascade } from '../utils/cascadeDelete.js';
import { runInTransaction } from '../utils/transaction.js';
import { toSearchRegex, parsePagination, buildPagination, handleKnownDbError, pickAllowed } from '../utils/request.js';

const DIRECTORY_ROLES = ['owner', 'tenant'];
const FAVOURITE_TYPES = ['owner', 'property'];

// Fields anyone may see in the public directory and on profiles
const PUBLIC_USER_FIELDS = 'name email role profileImage createdAt';

const isSameUser = (user, id) => !!user && String(user._id) === String(id);

// Owners with a completed booking from this tenant may see the tenant's phone
const ownerHasCompletedBookingWith = async (ownerId, tenantId) => {
  const propertyIds = await Property.find({ owner: ownerId }).distinct('_id');
  if (!propertyIds.length) return false;
  return !!(await Booking.exists({ tenant: tenantId, status: 'completed', property: { $in: propertyIds } }));
};

// Phone numbers are private: visible to the user, admins, anyone for owners
// (it is their business contact), and owners who completed a booking with a tenant
const canSeePhone = async (viewer, target) => {
  if (!viewer) return target.role === 'owner';
  if (isSameUser(viewer, target._id) || viewer.role === 'admin' || target.role === 'owner') return true;
  if (target.role === 'tenant' && viewer.role === 'owner') {
    return ownerHasCompletedBookingWith(viewer._id, target._id);
  }
  return false;
};

// @desc Update user profile (self or admin)
// @route PUT /api/users/:id
// @access Private (Self or Admin)
export const updateUserProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const targetId = req.params.id;
    const isSelf = isSameUser(req.user, targetId);
    const isAdmin = req.user.role === 'admin';
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: 'User not found' });

    // Only plain strings may reach the update (rejects objects like {"$set": ...})
    const { name, phone, profileImage } = req.body;
    const updates = {};
    if (typeof name === 'string') updates.name = name;
    if (typeof phone === 'string') updates.phone = phone;
    if (typeof profileImage === 'string') updates.profileImage = profileImage;
    const role = pickAllowed(req.body.role, DIRECTORY_ROLES);
    if (role) updates.role = role;

    if (updates.role !== undefined && updates.role !== target.role) {
      // Admin accounts are managed through scripts/createAdmin.js only
      if (updates.role === 'admin' || target.role === 'admin') {
        return res.status(403).json({ message: 'Admin roles cannot be changed here' });
      }
      // An owner with live listings must remove them before becoming a tenant
      if (target.role === 'owner' && await Property.exists({ owner: target._id, isActive: true })) {
        return res.status(409).json({ message: 'Remove your active property listings before switching to a tenant account' });
      }
    }

    const user = await User.findByIdAndUpdate(targetId, updates, { returnDocument: 'after', runValidators: true }).select('-password');

    res.json({ message: 'Profile updated successfully', data: { user } });
  } catch (error) {
    if (handleKnownDbError(res, error)) return;
    console.error('Update user profile error:', error);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
};

// @desc Get all active users (directory listing)
// @route GET /api/users
// @access Public
export const getUsers = async (req, res) => {
  try {
    const { role, search } = req.query;
    const { page, limit, skip } = parsePagination(req.query);
    // The public directory lists owners and tenants only
    const query = { isActive: true, role: { $in: ['owner', 'tenant'] } };

    if (role !== undefined) {
      const roleFilter = pickAllowed(role, DIRECTORY_ROLES);
      if (!roleFilter) {
        return res.status(400).json({ message: 'role must be owner or tenant' });
      }
      query.role = roleFilter;
    }

    const searchRegex = toSearchRegex(search);
    if (searchRegex) {
      query.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    const users = await User.find(query)
      .select(PUBLIC_USER_FIELDS)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

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
        pagination: buildPagination(total, page, limit)
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
    const { itemId } = req.body;
    const itemType = pickAllowed(req.body.itemType, FAVOURITE_TYPES);
    if (!itemId || !itemType) {
      return res.status(400).json({ message: 'itemId and valid itemType are required' });
    }
    if (typeof itemId !== 'string' || !mongoose.isValidObjectId(itemId)) {
      return res.status(400).json({ message: 'Invalid itemId' });
    }

    const itemExists = itemType === 'owner'
      ? await User.exists({ _id: itemId, role: 'owner', isActive: true })
      : await Property.exists({ _id: itemId, isActive: true });
    if (!itemExists) {
      return res.status(404).json({ message: `${itemType === 'owner' ? 'Owner' : 'Property'} not found` });
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
    if (handleKnownDbError(res, error)) return;
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

// @desc Delete a user (self or admin) and all of their related data
// @route DELETE /api/users/:id
// @access Private (Self or Admin)
export const deleteUser = async (req, res) => {
  try {
    const targetId = req.params.id;
    const isSelf = isSameUser(req.user, targetId);
    const isAdmin = req.user.role === 'admin';
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const user = await User.findById(targetId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Admin accounts cannot be removed through the API (self-deletion would lock the platform out)
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Admin accounts cannot be deleted' });
    }

    await runInTransaction((session) => deleteUserCascade(user, session));

    res.json({ message: 'User and related data deleted successfully', data: { id: targetId } });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error while deleting user' });
  }
};

// @desc Get single user profile
// @route GET /api/users/:id
// @access Public (phone number only for permitted viewers)
export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(`${PUBLIC_USER_FIELDS} phone isActive`);

    if (!user || !user.isActive) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = user.toObject();
    delete userData.isActive;
    if (!(await canSeePhone(req.user, user))) {
      delete userData.phone;
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
        user: userData,
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

// @desc Search owners and tenants by name or email
// @route GET /api/users/search
// @access Public
export const searchUsers = async (req, res) => {
  try {
    const { q, role } = req.query;

    const searchRegex = typeof q === 'string' && q.trim().length >= 2 ? toSearchRegex(q) : null;
    if (!searchRegex) {
      return res.json({ data: { users: [] } });
    }

    const query = {
      isActive: true,
      role: { $in: ['owner', 'tenant'] },
      $or: [{ name: searchRegex }, { email: searchRegex }]
    };

    if (role !== undefined) {
      const roleFilter = pickAllowed(role, DIRECTORY_ROLES);
      if (!roleFilter) {
        return res.status(400).json({ message: 'role must be owner or tenant' });
      }
      query.role = roleFilter;
    }

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
    const target = await User.findById(req.params.id).select('_id role');
    if (!target) return res.status(404).json({ message: 'User not found' });

    const canView = await canSeePhone(req.user, target);
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { isActive } = req.body;
    const user = await User.findById(req.params.id).select('name email role isActive');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Admin accounts cannot be deactivated' });
    }

    // Update only the flag so legacy documents with outdated fields still save
    await User.updateOne({ _id: user._id }, { $set: { isActive } });

    res.json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive
        }
      }
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'Server error while updating user status' });
  }
};
