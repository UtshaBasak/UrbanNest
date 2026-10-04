import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import Booking from '../models/Booking.js';
import Property from '../models/Property.js';
import LeaveRequest from '../models/LeaveRequest.js';
import { createNotification } from './notificationController.js';
import { parsePagination, buildPagination, handleKnownDbError } from '../utils/request.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BOOKING_STATUSES = ['pending', 'approved', 'rejected', 'cancelled', 'completed'];
// Owners mark these statuses manually; bookings never override them
const UNBOOKABLE_STATUSES = ['Not Available', 'Under Construction'];
// Bookings that are finished can be removed from history; active ones must be cancelled first
const DELETABLE_STATUSES = ['rejected', 'cancelled', 'completed'];

// Approved bookings whose date range overlaps [start, end)
const findOverlappingApprovedBookings = (propertyId, start, end, excludeId) => Booking.find({
  property: propertyId,
  status: 'approved',
  ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  startDate: { $lt: end },
  endDate: { $gt: start }
});

const formatRanges = (bookings) => bookings
  .map(b => `${new Date(b.startDate).toLocaleDateString()} - ${new Date(b.endDate).toLocaleDateString()}`)
  .join(', ');

// Keep availabilityStatus in sync with current occupancy, but only toggle between
// Available and Booked so statuses set by the owner are preserved
const updatePropertyAvailability = async (propertyId) => {
  const property = await Property.findById(propertyId).select('availabilityStatus');
  if (!property || !['Available', 'Booked'].includes(property.availabilityStatus)) return;

  const now = new Date();
  const occupied = await Booking.exists({
    property: propertyId,
    status: 'approved',
    startDate: { $lte: now },
    endDate: { $gte: now }
  });
  const next = occupied ? 'Booked' : 'Available';
  if (property.availabilityStatus !== next) {
    await Property.updateOne({ _id: propertyId }, { $set: { availabilityStatus: next } });
  }
};

const notifySafely = async (payload, context) => {
  try {
    await createNotification(payload);
  } catch (e) {
    console.error(`Failed to create notification (${context}):`, e.message);
  }
};

// @desc Create booking request
// @route POST /api/bookings
// @access Private (Tenant)
export const createBooking = async (req, res) => {
  try {
    const { property: propertyId, startDate, endDate, message } = req.body;

    if (!mongoose.isValidObjectId(propertyId)) {
      return res.status(400).json({ message: 'A valid property is required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Valid start and end dates are required' });
    }
    if (end <= start) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }
    if (message !== undefined && (typeof message !== 'string' || message.length > 1000)) {
      return res.status(400).json({ message: 'Message must be text of at most 1000 characters' });
    }

    const property = await Property.findOne({ _id: propertyId, isActive: true });
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }
    if (UNBOOKABLE_STATUSES.includes(property.availabilityStatus)) {
      return res.status(400).json({ message: 'Property is not available for booking' });
    }
    if (property.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot book your own property' });
    }

    // Overlapping dates are what matter, so a property occupied now can still
    // accept requests for dates after the current lease ends
    const conflictingBookings = await findOverlappingApprovedBookings(property._id, start, end);
    if (conflictingBookings.length > 0) {
      return res.status(400).json({
        message: `Cannot create booking request due to conflicts with approved bookings: ${formatRanges(conflictingBookings)}`,
        conflictingBookings: conflictingBookings.map(cb => ({ id: cb._id, startDate: cb.startDate, endDate: cb.endDate }))
      });
    }

    // Price is monthly rent: charge pro rata per day (30-day month)
    const days = Math.max(1, Math.ceil((end - start) / MS_PER_DAY));
    const totalAmount = Math.round((property.price * days) / 30);

    const booking = await Booking.create({
      tenant: req.user._id,
      property: property._id,
      startDate: start,
      endDate: end,
      totalAmount,
      message
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate('tenant', 'name email phone')
      .populate('property', 'title location price images');

    await notifySafely({
      user: property.owner,
      title: 'New booking request',
      message: `${req.user.name || 'A tenant'} requested to book ${property.title} (${start.toLocaleDateString()} - ${end.toLocaleDateString()}).`,
      link: '/dashboard?tab=bookings',
      meta: { bookingId: booking._id, propertyId: property._id }
    }, 'createBooking');

    res.status(201).json({
      message: 'Booking request created successfully',
      data: { booking: populatedBooking }
    });

  } catch (error) {
    if (handleKnownDbError(res, error)) return;
    console.error('Create booking error:', error);
    res.status(500).json({ message: 'Server error while creating booking' });
  }
};

// @desc Get user's bookings
// @route GET /api/bookings/my
// @access Private
export const getMyBookings = async (req, res) => {
  try {
    const { status } = req.query;
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10 });
    const query = {};

    if (req.user.role === 'tenant') {
      query.tenant = req.user._id;
    } else if (req.user.role === 'owner') {
      const propertyIds = await Property.find({ owner: req.user._id }).distinct('_id');
      query.property = { $in: propertyIds };
    }

    if (status !== undefined) {
      if (!BOOKING_STATUSES.includes(status)) {
        return res.status(400).json({ message: 'Invalid status filter' });
      }
      query.status = status;
    }

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('tenant', 'name email phone')
        .populate({
          path: 'property',
          select: 'title location price images owner',
          populate: { path: 'owner', select: 'name email _id' }
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip),
      Booking.countDocuments(query)
    ]);

    res.json({
      data: {
        bookings,
        pagination: buildPagination(total, page, limit)
      }
    });

  } catch (error) {
    console.error('Get my bookings error:', error);
    res.status(500).json({ message: 'Server error while fetching bookings' });
  }
};

// @desc Approve or reject a pending booking
// @route PUT /api/bookings/:id/status
// @access Private (Owner, Admin)
export const updateBookingStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { status, rejectionReason } = req.body;
    const booking = await Booking.findById(req.params.id).populate('property');

    if (!booking || !booking.property) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (req.user.role !== 'admin' && booking.property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ message: `Only pending bookings can be ${status}; this one is ${booking.status}` });
    }

    if (status === 'approved') {
      const conflictingBookings = await findOverlappingApprovedBookings(
        booking.property._id, booking.startDate, booking.endDate, booking._id
      );
      if (conflictingBookings.length > 0) {
        return res.status(400).json({
          message: `Cannot approve booking due to date conflicts with existing approved bookings: ${formatRanges(conflictingBookings)}`,
          conflictingBookings: conflictingBookings.map(cb => ({
            id: cb._id, startDate: cb.startDate, endDate: cb.endDate, tenant: cb.tenant
          }))
        });
      }
    }

    // Conditional update so two concurrent decisions cannot both succeed
    const update = { status };
    if (status === 'rejected' && rejectionReason) update.rejectionReason = rejectionReason;
    const decided = await Booking.findOneAndUpdate(
      { _id: booking._id, status: 'pending' },
      { $set: update },
      { returnDocument: 'after' }
    );
    if (!decided) {
      return res.status(409).json({ message: 'This booking was already decided' });
    }

    if (status === 'approved') {
      await updatePropertyAvailability(booking.property._id);
    }

    await notifySafely({
      user: booking.tenant,
      title: status === 'approved' ? 'Booking approved' : 'Booking rejected',
      message: status === 'approved'
        ? `Your booking for ${booking.property.title} was approved.`
        : `Your booking for ${booking.property.title} was rejected${rejectionReason ? `: ${rejectionReason}` : ''}.`,
      link: '/dashboard?tab=bookings',
      meta: { bookingId: booking._id, propertyId: booking.property._id }
    }, 'updateBookingStatus');

    const updatedBooking = await Booking.findById(booking._id)
      .populate('tenant', 'name email phone')
      .populate('property', 'title location price images');

    res.json({
      message: 'Booking status updated successfully',
      data: { booking: updatedBooking }
    });

  } catch (error) {
    if (handleKnownDbError(res, error)) return;
    console.error('Update booking status error:', error);
    res.status(500).json({ message: 'Server error while updating booking status' });
  }
};

// @desc Delete a finished booking from history
// @route DELETE /api/bookings/:id
// @access Private (Tenant who made booking, Owner of property, Admin)
export const deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('property', 'owner');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const userId = req.user._id.toString();
    const isTenant = booking.tenant.toString() === userId;
    const isPropertyOwner = booking.property?.owner?.toString() === userId;
    const isAdmin = req.user.role === 'admin';

    if (!isTenant && !isPropertyOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Active bookings must go through cancel/reject so the other party is notified
    if (!isAdmin && !DELETABLE_STATUSES.includes(booking.status)) {
      return res.status(400).json({ message: 'Only rejected, cancelled or completed bookings can be deleted. Cancel the booking first.' });
    }

    await LeaveRequest.deleteMany({ booking: booking._id });
    await Booking.deleteOne({ _id: booking._id });

    if (booking.status === 'approved' && booking.property) {
      await updatePropertyAvailability(booking.property._id);
    }

    res.json({ message: 'Booking deleted successfully', data: { id: req.params.id } });

  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ message: 'Server error while deleting booking' });
  }
};

// @desc Cancel booking
// @route PUT /api/bookings/:id/cancel
// @access Private (Tenant who made booking)
export const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.tenant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (booking.status !== 'pending' && booking.status !== 'approved') {
      return res.status(400).json({ message: 'Booking cannot be cancelled' });
    }

    const wasApproved = booking.status === 'approved';
    booking.status = 'cancelled';
    await booking.save();

    if (wasApproved) {
      await updatePropertyAvailability(booking.property);
    }

    const property = await Property.findById(booking.property).select('owner title');
    if (property) {
      await notifySafely({
        user: property.owner,
        title: 'Booking cancelled',
        message: `${req.user.name || 'A tenant'} cancelled their booking for ${property.title}.`,
        link: '/dashboard?tab=bookings',
        meta: { bookingId: booking._id, propertyId: booking.property }
      }, 'cancelBooking');
    }

    res.json({
      message: 'Booking cancelled successfully',
      data: { booking }
    });

  } catch (error) {
    if (handleKnownDbError(res, error)) return;
    console.error('Cancel booking error:', error);
    res.status(500).json({ message: 'Server error while cancelling booking' });
  }
};

export { updatePropertyAvailability };
