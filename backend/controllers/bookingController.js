import { validationResult } from 'express-validator';
import Booking from '../models/Booking.js';
import Property from '../models/Property.js';
import Transaction from '../models/Transaction.js';
import { createNotification } from './notificationController.js';

// @desc Create booking request
// @route POST /api/bookings
// @access Private (Tenant)
export const createBooking = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { property: propertyId, startDate, endDate, message } = req.body;

    // Check if property exists and is available
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }
    const availability = property.availability || property.availabilityStatus;
    if (availability !== 'Available') {
      return res.status(400).json({ message: 'Property is not available for booking' });
    }

    // Check if user is trying to book their own property
    if (property.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot book your own property' });
    }

    // Calculate total amount with lenient date handling
    let start = new Date(startDate);
    let end = new Date(endDate);
    // If either date is invalid, default to a 1-day booking from today
    if (isNaN(start.getTime())) {
      start = new Date();
    }
    if (isNaN(end.getTime())) {
      end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    }
    // If end is before or equal to start, make it at least 1 day
    if (end <= start) {
      end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    }
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysRaw = Math.ceil((end - start) / msPerDay);
    const days = Math.max(daysRaw, 1);
    const totalAmount = property.price * days;

    const booking = new Booking({
      tenant: req.user._id,
      property: propertyId,
      startDate: start,
      endDate: end,
      totalAmount,
      message
    });

    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate('tenant', 'name email phone')
      .populate('property', 'title location price images');

    // Notify owner about new booking request
    try {
      await createNotification({
        user: property.owner,
        title: 'New booking request',
        message: `${req.user.name || 'A tenant'} requested to book ${property.title} (${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}).`,
        link: `/dashboard?tab=bookings`,
        meta: { bookingId: booking._id, propertyId: property._id }
      });
    } catch (e) {
      console.error('Failed to create notification (createBooking):', e.message);
    }

    res.status(201).json({
      message: 'Booking request created successfully',
      data: { booking: populatedBooking }
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ message: 'Server error while creating booking' });
  }
};

// @desc Get user's bookings
// @route GET /api/bookings/my
// @access Private
export const getMyBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = {};

    if (req.user.role === 'tenant') {
      query.tenant = req.user._id;
    } else if (req.user.role === 'owner') {
      // Get bookings for properties owned by this user
      const properties = await Property.find({ owner: req.user._id });
      query.property = { $in: properties.map(p => p._id) };
    }

    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('tenant', 'name email phone')
      .populate({
        path: 'property',
        select: 'title location price images owner',
        populate: {
          path: 'owner',
          select: 'name email _id'
        }
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Booking.countDocuments(query);

    res.json({
      data: {
        bookings,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
          limit: Number(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get my bookings error:', error);
    res.status(500).json({ message: 'Server error while fetching bookings' });
  }
};

// @desc Update booking status
// @route PUT /api/bookings/:id/status
// @access Private (Owner, Admin)
export const updateBookingStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const booking = await Booking.findById(req.params.id)
      .populate('property');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if user owns the property or is admin
    if (req.user.role !== 'admin' && 
        booking.property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    booking.status = status;
    if (status === 'rejected' && rejectionReason) {
      booking.rejectionReason = rejectionReason;
    }

    await booking.save();

    // Update property availability if approved
    if (status === 'approved') {
      await Property.findByIdAndUpdate(booking.property._id, {
        availabilityStatus: 'Booked',
        availability: 'Booked'
      });

      // Note: No automatic transaction creation on booking approval
      // Tenants must manually make monthly payments through the payment form
    }

    // Notify tenant of decision
    try {
      if (status === 'approved') {
        await createNotification({
          user: booking.tenant,
          title: 'Booking approved',
          message: `Your booking for ${booking.property.title} was approved.`,
          link: `/dashboard?tab=bookings`,
          meta: { bookingId: booking._id, propertyId: booking.property._id }
        });
      } else if (status === 'rejected') {
        await createNotification({
          user: booking.tenant,
          title: 'Booking rejected',
          message: `Your booking for ${booking.property.title} was rejected${rejectionReason ? `: ${rejectionReason}` : ''}.`,
          link: `/dashboard?tab=bookings`,
          meta: { bookingId: booking._id, propertyId: booking.property._id }
        });
      }
    } catch (e) {
      console.error('Failed to create notification (updateBookingStatus):', e.message);
    }

    const updatedBooking = await Booking.findById(booking._id)
      .populate('tenant', 'name email phone')
      .populate('property', 'title location price images');

    res.json({
      message: 'Booking status updated successfully',
      data: { booking: updatedBooking }
    });

  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({ message: 'Server error while updating booking status' });
  }
};

// @desc Cancel booking
// @route PUT /api/bookings/:id/cancel
// @access Private (Tenant who made booking)
// @desc Delete booking
// @route DELETE /api/bookings/:id
// @access Private (Tenant who made booking, Owner of property, Admin)
export const deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('property', 'owner');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check permissions: tenant who made booking, property owner, or admin
    const isTenant = booking.tenant.toString() === req.user._id.toString();
    const isPropertyOwner = booking.property.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isTenant && !isPropertyOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Delete related transactions first
    await Transaction.deleteMany({ booking: booking._id });
    
    // Delete the booking
    await Booking.findByIdAndDelete(req.params.id);

    // Update property availability if it was booked
    if (booking.status === 'approved') {
      await Property.findByIdAndUpdate(booking.property._id, {
        availabilityStatus: 'Available',
        availability: 'Available'
      });
    }

    res.json({ message: 'Booking deleted successfully', data: { id: req.params.id } });

  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ message: 'Server error while deleting booking' });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if user owns the booking
    if (booking.tenant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (booking.status !== 'pending' && booking.status !== 'approved') {
      return res.status(400).json({ message: 'Booking cannot be cancelled' });
    }

    const wasApproved = booking.status === 'approved';
    booking.status = 'cancelled';
    await booking.save();

    // Update property availability if it was booked
    if (wasApproved) {
      await Property.findByIdAndUpdate(booking.property, {
        availabilityStatus: 'Available',
        availability: 'Available'
      });
    }

    // Notify owner that tenant cancelled
    try {
      await createNotification({
        user: (await Property.findById(booking.property)).owner,
        title: 'Booking cancelled',
        message: `${req.user.name || 'Tenant'} cancelled a booking request for your property.`,
        link: `/dashboard?tab=bookings`,
        meta: { bookingId: booking._id, propertyId: booking.property }
      });
    } catch (e) {
      console.error('Failed to create notification (cancelBooking):', e.message);
    }

    res.json({
      message: 'Booking cancelled successfully',
      data: { booking }
    });

  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ message: 'Server error while cancelling booking' });
  }
};