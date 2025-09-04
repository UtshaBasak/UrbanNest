import User from '../models/User.js';
import Property from '../models/Property.js';
import UserRating from '../models/UserRating.js';
import mongoose from 'mongoose';

// @desc Get all owners with search functionality
// @route GET /api/admin/owners
// @access Private (Admin only)
export const getOwners = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = { role: 'owner', isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const owners = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

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
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
          limit: Number(limit)
        }
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
    const { page = 1, limit = 20, search } = req.query;
    const query = { role: 'tenant', isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const tenants = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

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
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
          limit: Number(limit)
        }
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
    const { page = 1, limit = 20, search } = req.query;
    const query = { isActive: true };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } },
        { 'location.state': { $regex: search, $options: 'i' } }
      ];
    }

    const properties = await Property.find(query)
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

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

// @desc Delete a user (admin only)
// @route DELETE /api/admin/users/:id
// @access Private (Admin only)
export const deleteUserById = async (req, res) => {
  const userId = req.params.id;
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Find the user to delete
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }

      // Prevent admin from deleting themselves
      if (req.user._id.toString() === userId) {
        throw new Error('Cannot delete your own admin account');
      }

      // Prevent deleting other admins
      if (user.role === 'admin') {
        throw new Error('Cannot delete admin accounts');
      }

      // If it's an owner, we need to cascade delete their properties and related data
      let propertyIds = [];
      if (user.role === 'owner') {
        const properties = await Property.find({ owner: userId }, '_id').session(session);
        propertyIds = properties.map(p => p._id);
        
        // Delete owner's properties
        await Property.deleteMany({ owner: userId }).session(session);
      }

      // Delete user's bookings (as tenant or bookings for their properties)
      const bookingFilter = user.role === 'owner'
        ? { $or: [{ tenant: userId }, { property: { $in: propertyIds } }] }
        : { tenant: userId };
      await mongoose.model('Booking').deleteMany(bookingFilter).session(session);

      // Delete user's reviews (as tenant or reviews for their properties)
      const reviewFilter = user.role === 'owner'
        ? { $or: [{ tenant: userId }, { property: { $in: propertyIds } }] }
        : { tenant: userId };
      await mongoose.model('Review').deleteMany(reviewFilter).session(session);

      // Delete user's notifications
      await mongoose.model('Notification').deleteMany({ user: userId }).session(session);

      // Delete user's ratings (given and received)
      await UserRating.deleteMany({
        $or: [{ rater: userId }, { ratee: userId }]
      }).session(session);

      // Finally, delete the user
      await User.findByIdAndDelete(userId).session(session);
    });

    res.json({ message: 'User and related data deleted successfully' });

  } catch (error) {
    console.error('Delete user error:', error);
    if (error.message === 'User not found') {
      return res.status(404).json({ message: 'User not found' });
    }
    if (error.message === 'Cannot delete your own admin account' || 
        error.message === 'Cannot delete admin accounts') {
      return res.status(403).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error during user deletion' });
  } finally {
    session.endSession();
  }
};

// @desc Delete a property (admin only)
// @route DELETE /api/admin/properties/:id
// @access Private (Admin only)
export const deletePropertyById = async (req, res) => {
  const propertyId = req.params.id;
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Check if property exists
      const property = await Property.findById(propertyId).session(session);
      if (!property) {
        throw new Error('Property not found');
      }

      // Delete related bookings
      await mongoose.model('Booking').deleteMany({ property: propertyId }).session(session);

      // Delete related reviews
      await mongoose.model('Review').deleteMany({ property: propertyId }).session(session);

      // Remove from user favourites
      await User.updateMany(
        { 'favourites.itemId': propertyId, 'favourites.itemType': 'property' },
        { $pull: { favourites: { itemId: propertyId, itemType: 'property' } } }
      ).session(session);

      // Delete the property
      await Property.findByIdAndDelete(propertyId).session(session);
    });

    res.json({ message: 'Property and related data deleted successfully' });

  } catch (error) {
    console.error('Delete property error:', error);
    if (error.message === 'Property not found') {
      return res.status(404).json({ message: 'Property not found' });
    }
    res.status(500).json({ message: 'Server error during property deletion' });
  } finally {
    session.endSession();
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
      totalReviews
    ] = await Promise.all([
      User.countDocuments({ isActive: true, role: { $ne: 'admin' } }),
      User.countDocuments({ role: 'owner', isActive: true }),
      User.countDocuments({ role: 'tenant', isActive: true }),
      Property.countDocuments({ isActive: true }),
      mongoose.model('Booking').countDocuments(),
      mongoose.model('Review').countDocuments()
    ]);

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
