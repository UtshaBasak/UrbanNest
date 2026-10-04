import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import User from '../models/User.js';
import { deleteUserCascade } from '../utils/cascadeDelete.js';
import { runInTransaction } from '../utils/transaction.js';
import { handleKnownDbError } from '../utils/request.js';

const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

// Shared cookie options. Set COOKIE_SAME_SITE=none when the frontend and API
// are served from different domains (requires HTTPS).
const cookieOptions = () => {
  const sameSite = process.env.COOKIE_SAME_SITE || 'strict';
  return {
    httpOnly: true,
    // Browsers reject SameSite=None cookies that are not Secure
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    sameSite,
    path: '/'
  };
};

// Set secure HTTP-only cookie
const setTokenCookie = (res, token) => {
  res.cookie('token', token, { ...cookieOptions(), maxAge: TOKEN_MAX_AGE_MS });
};

const clearTokenCookie = (res) => {
  res.clearCookie('token', cookieOptions());
};

// Public shape of a user returned by auth endpoints
const toAuthUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  profileImage: user.profileImage
});

// @desc Delete current user (hard delete + cascade)
// @route DELETE /api/auth/me
// @access Private
export const deleteCurrentUser = async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({ message: 'Admin accounts cannot be deleted' });
    }

    await runInTransaction(async (session) => {
      const user = await User.findById(req.user._id).session(session);
      if (!user) throw new Error('User not found');
      await deleteUserCascade(user, session);
    });

    clearTokenCookie(res);
    return res.json({ message: 'Account and related data deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Server error during account deletion' });
  }
};

// @desc Register user
// @route POST /api/auth/register
// @access Public
export const register = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
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

    // Create user (admin accounts can only be created via scripts/createAdmin.js)
    const user = new User({
      name,
      email,
      password,
      phone,
      role: role === 'owner' ? 'owner' : 'tenant',
      profileImage: profileImage || ''
    });

    await user.save();

    // Generate token and set cookie
    const token = generateToken(user._id);
    setTokenCookie(res, token);

    res.status(201).json({
      message: 'User registered successfully',
      data: {
        user: toAuthUser(user)
      }
    });
  } catch (error) {
    if (handleKnownDbError(res, error)) return;
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
    const user = await User.findOne({ email });
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
        user: toAuthUser(user)
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
  clearTokenCookie(res);
  
  res.json({ message: 'Logout successful' });
};

// @desc Get current user
// @route GET /api/auth/me
// @access Private
export const getCurrentUser = (req, res) => {
  res.json({
    data: {
      user: toAuthUser(req.user)
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
      { returnDocument: 'after', runValidators: true }
    );

    res.json({
      message: 'Profile updated successfully',
      data: {
        user
      }
    });

  } catch (error) {
    if (handleKnownDbError(res, error)) return;
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error during profile update' });
  }
};