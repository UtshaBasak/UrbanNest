import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Property from '../models/Property.js';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import Notification from '../models/Notification.js';
import UserRating from '../models/UserRating.js';

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

// @desc Delete current user (hard delete + cascade)
// @route DELETE /api/auth/me
// @access Private
export const deleteCurrentUser = async (req, res) => {
  const userId = req.user._id;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Determine role for cascade behavior
      const user = await User.findById(userId).session(session);
      if (!user) throw new Error('User not found');

      // Collect related IDs for cascades
      let propertyIds = [];
      if (user.role === 'owner') {
        const properties = await Property.find({ owner: userId }, '_id').session(session);
        propertyIds = properties.map(p => p._id);
      }

      // Bookings: by tenant or by properties of this owner
      const bookingFilter = user.role === 'owner'
        ? { $or: [ { tenant: userId }, { property: { $in: propertyIds } } ] }
        : { tenant: userId };
      const bookings = await Booking.find(bookingFilter, '_id').session(session);
      const bookingIds = bookings.map(b => b._id);

      // Reviews by tenant or on owner's properties
      const reviewFilter = user.role === 'owner'
        ? { $or: [ { tenant: userId }, { property: { $in: propertyIds } } ] }
        : { tenant: userId };

      // Notifications for this user
      const notifFilter = { user: userId };

      // User ratings given or received by this user
      const ratingFilter = { $or: [ { rater: userId }, { ratee: userId } ] };

      // Execute deletions
      await Promise.all([
        // Properties (owner only)
        propertyIds.length ? Property.deleteMany({ _id: { $in: propertyIds } }).session(session) : Promise.resolve(),
        // Bookings
        Booking.deleteMany(bookingFilter).session(session),
        // Reviews
        Review.deleteMany(reviewFilter).session(session),
        // Notifications
        Notification.deleteMany(notifFilter).session(session),
        // User ratings
        UserRating.deleteMany(ratingFilter).session(session),
      ]);

      // Finally, delete the user
      await User.findByIdAndDelete(userId).session(session);
    });

    // Clear auth cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
    return res.json({ message: 'Account and related data deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Server error during account deletion' });
  } finally {
    session.endSession();
  }
};

// Set secure HTTP-only cookie
const setTokenCookie = (res, token) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/'
  };
  
  res.cookie('token', token, cookieOptions);
};

// @desc Register user
// @route POST /api/auth/register
// @access Public
export const register = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(errors);
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { name, email, password, phone, role, profileImage } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Create user
    const user = new User({
      name,
      email,
      password,
      phone,
      role: role || 'tenant',
      profileImage: profileImage || ''
    });

    await user.save();

    // Generate token and set cookie
    const token = generateToken(user._id);
    setTokenCookie(res, token);

    res.status(201).json({
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          profileImage: user.profileImage
        }
      }
    });


  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// @desc Login user
// @route POST /api/auth/login
// @access Public
export const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token and set cookie
    const token = generateToken(user._id);
    setTokenCookie(res, token);

    res.json({
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          profileImage: user.profileImage
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// @desc Logout user
// @route POST /api/auth/logout
// @access Private
export const logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
  
  res.json({ message: 'Logout successful' });
};

// @desc Get current user
// @route GET /api/auth/me
// @access Private
export const getCurrentUser = (req, res) => {
  res.json({
    data: {
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        role: req.user.role,
        profileImage: req.user.profileImage
      }
    }
  });
};

// @desc Update current user
// @route PUT /api/auth/me
// @access Private
export const updateCurrentUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { name, phone, profileImage } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, profileImage },
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Profile updated successfully',
      data: {
        user
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error during profile update' });
  }
};