import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';

const findUserFromToken = async (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.userId).select('-password');
  return user && user.isActive ? user : null;
};

// Verify JWT token from HTTP-only cookie
export const authenticateToken = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const user = await findUserFromToken(token);
    if (!user) {
      return res.status(401).json({ message: 'Invalid token or user not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token.' });
  }
};

// Attach req.user when a valid cookie is present, but never reject the request.
// Used by public endpoints that reveal more to the owner of the data.
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (token) {
      req.user = (await findUserFromToken(token)) || undefined;
    }
  } catch {
    req.user = undefined;
  }
  next();
};

// Role-based access control
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

// Check that the authenticated user owns the resource (admins always pass).
// ownerField names the document field holding the owner's user id.
export const checkOwnership = (Model, paramName = 'id', ownerField = 'owner') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[paramName];
      if (!mongoose.isValidObjectId(resourceId)) {
        return res.status(400).json({ message: 'Invalid id' });
      }

      const resource = await Model.findById(resourceId);
      if (!resource) {
        return res.status(404).json({ message: 'Resource not found' });
      }

      if (req.user.role === 'admin') {
        return next();
      }

      const ownerId = resource[ownerField];
      if (!ownerId || ownerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: 'Access denied. You can only access your own resources.'
        });
      }

      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      res.status(500).json({ message: 'Server error during authorization' });
    }
  };
};
