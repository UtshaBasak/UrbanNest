import LeaveRequest from '../models/LeaveRequest.js';
import Booking from '../models/Booking.js';
import Property from '../models/Property.js';
import { createNotification } from './notificationController.js';

// Utility to compute effective end date based on condition
function computeEffectiveEndDate(condition, booking) {
  const now = new Date();
  const endOfMonth = (d) => {
    const dt = new Date(d);
    return new Date(dt.getFullYear(), dt.getMonth() + 1, 0, 23, 59, 59, 999);
  };
  const endOfNextMonth = (d) => {
    const dt = new Date(d);
    return new Date(dt.getFullYear(), dt.getMonth() + 2, 0, 23, 59, 59, 999);
  };

  switch (condition) {
    case 'immediate':
      return now;
    case 'end_of_month':
      return endOfMonth(now);
    case 'end_of_next_month':
      return endOfNextMonth(now);
    case 'end_of_current_booking':
    default:
      return new Date(booking.endDate);
  }
}

// Tenant: create leave request
export const createLeaveRequest = async (req, res) => {
  try {
    const { bookingId, message = '' } = req.body;
    const booking = await Booking.findById(bookingId).populate({ path: 'property', select: 'owner availability availabilityStatus title' });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.tenant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (!['approved'].includes(booking.status)) {
      return res.status(400).json({ message: 'Only active (approved) bookings can request leave' });
    }

    const existing = await LeaveRequest.findOne({ booking: booking._id, status: 'pending' });
    if (existing) {
      return res.status(400).json({ message: 'There is already a pending leave request for this booking' });
    }

    const lr = await LeaveRequest.create({
      booking: booking._id,
      tenant: req.user._id,
      owner: booking.property.owner,
      message,
    });

    // Notify owner
    try {
      await createNotification({
        user: booking.property.owner,
        title: 'Leave request received',
        message: `${req.user.name || 'Tenant'} requested to leave early for ${booking.property.title}.`,
        link: `/dashboard?tab=bookings`,
        meta: { bookingId: booking._id, leaveRequestId: lr._id }
      });
    } catch (e) {
      // log only
       
      console.error('Failed to create notification (createLeaveRequest):', e.message);
    }

    res.status(201).json({ message: 'Leave request submitted', data: { leaveRequest: lr } });
  } catch (error) {
    console.error('createLeaveRequest error:', error);
    res.status(500).json({ message: 'Server error while creating leave request' });
  }
};

// Tenant/Owner: list related leave requests
export const listMyLeaveRequests = async (req, res) => {
  try {
    const query = {};
    if (req.user.role === 'tenant') query.tenant = req.user._id;
    if (req.user.role === 'owner') query.owner = req.user._id;
    const { status } = req.query;
    if (status) query.status = status;

    const items = await LeaveRequest.find(query)
      .populate({ path: 'booking', select: 'startDate endDate status property tenant', populate: { path: 'property', select: 'title' } })
      .sort({ createdAt: -1 });

    res.json({ data: { leaveRequests: items } });
  } catch (error) {
     
    console.error('listMyLeaveRequests error:', error);
    res.status(500).json({ message: 'Server error while listing leave requests' });
  }
};

// Owner: decide on leave request
export const decideLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, condition = 'end_of_month', note = '' } = req.body; // decision: 'approve' | 'reject'

    const lr = await LeaveRequest.findById(id).populate({ path: 'booking', populate: { path: 'property', select: 'owner availability availabilityStatus title' } });
    if (!lr) return res.status(404).json({ message: 'Leave request not found' });

    // Only owner of booking's property (or admin) can decide
    const isOwner = lr.booking.property.owner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Access denied' });
    if (lr.status !== 'pending') return res.status(400).json({ message: 'This request has already been decided' });

    if (decision === 'reject') {
      lr.status = 'rejected';
      lr.decisionNote = note;
      await lr.save();

      try {
        await createNotification({
          user: lr.tenant,
          title: 'Leave request rejected',
          message: `Your leave request was rejected. ${note ? `Note: ${note}` : ''}`,
          link: `/dashboard?tab=bookings`,
          meta: { leaveRequestId: lr._id, bookingId: lr.booking._id }
        });
      } catch {}

      return res.json({ message: 'Request rejected', data: { leaveRequest: lr } });
    }

    // Approve path
    const effectiveEndDate = computeEffectiveEndDate(condition, lr.booking);

    lr.status = 'approved';
    lr.condition = condition;
    lr.decisionNote = note;
    lr.effectiveEndDate = effectiveEndDate;
    await lr.save();

    // Apply to booking
    const booking = await Booking.findById(lr.booking._id);
    if (booking) {
      // shorten booking end date if earlier
      if (!booking.endDate || effectiveEndDate < booking.endDate) {
        booking.endDate = effectiveEndDate;
      }
      // if immediate and date is now or past, mark completed and free property
      if (effectiveEndDate <= new Date()) {
        booking.status = 'completed';
        await Property.findByIdAndUpdate(booking.property, { availability: 'Available', availabilityStatus: 'Available' });
      }
      await booking.save();
    }

    try {
      await createNotification({
        user: lr.tenant,
        title: 'Leave request approved',
        message: `Your leave was approved. Effective end date: ${new Date(effectiveEndDate).toLocaleString()}`,
        link: `/dashboard?tab=bookings`,
        meta: { leaveRequestId: lr._id, bookingId: lr.booking._id }
      });
    } catch {}

    res.json({ message: 'Request approved', data: { leaveRequest: lr } });
  } catch (error) {
     
    console.error('decideLeaveRequest error:', error);
    res.status(500).json({ message: 'Server error while deciding leave request' });
  }
};
