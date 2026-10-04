import mongoose from 'mongoose';
import LeaveRequest from '../models/LeaveRequest.js';
import Booking from '../models/Booking.js';
import { createNotification } from './notificationController.js';
import { updatePropertyAvailability } from './bookingController.js';

const DECISIONS = ['approve', 'reject'];
const CONDITIONS = ['immediate', 'end_of_month', 'end_of_next_month', 'end_of_current_booking'];
const LEAVE_STATUSES = ['pending', 'approved', 'rejected'];

// Utility to compute effective end date based on condition
function computeEffectiveEndDate(condition, booking) {
  const now = new Date();
  const endOfMonth = (d, offset) => new Date(d.getFullYear(), d.getMonth() + 1 + offset, 0, 23, 59, 59, 999);

  switch (condition) {
    case 'immediate':
      return now;
    case 'end_of_month':
      return endOfMonth(now, 0);
    case 'end_of_next_month':
      return endOfMonth(now, 1);
    case 'end_of_current_booking':
    default:
      return new Date(booking.endDate);
  }
}

const notifySafely = async (payload, context) => {
  try {
    await createNotification(payload);
  } catch (e) {
    console.error(`Failed to create notification (${context}):`, e.message);
  }
};

// Tenant: create leave request
export const createLeaveRequest = async (req, res) => {
  try {
    const { bookingId, message = '' } = req.body;
    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ message: 'A valid booking is required' });
    }
    if (typeof message !== 'string' || message.length > 1000) {
      return res.status(400).json({ message: 'Message must be text of at most 1000 characters' });
    }

    const booking = await Booking.findById(bookingId).populate({ path: 'property', select: 'owner title' });
    if (!booking || !booking.property) return res.status(404).json({ message: 'Booking not found' });
    if (booking.tenant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (booking.status !== 'approved') {
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

    await notifySafely({
      user: booking.property.owner,
      title: 'Leave request received',
      message: `${req.user.name || 'Tenant'} requested to leave early for ${booking.property.title}.`,
      link: '/leave-requests',
      meta: { bookingId: booking._id, leaveRequestId: lr._id }
    }, 'createLeaveRequest');

    res.status(201).json({ message: 'Leave request submitted', data: { leaveRequest: lr } });
  } catch (error) {
    console.error('createLeaveRequest error:', error);
    res.status(500).json({ message: 'Server error while creating leave request' });
  }
};

// Tenant/Owner: list related leave requests (admins see all)
export const listMyLeaveRequests = async (req, res) => {
  try {
    const query = {};
    if (req.user.role === 'tenant') query.tenant = req.user._id;
    if (req.user.role === 'owner') query.owner = req.user._id;
    const { status } = req.query;
    if (status !== undefined) {
      if (!LEAVE_STATUSES.includes(status)) {
        return res.status(400).json({ message: 'Invalid status filter' });
      }
      query.status = status;
    }

    const items = await LeaveRequest.find(query)
      .populate({ path: 'booking', select: 'startDate endDate status property tenant', populate: { path: 'property', select: 'title' } })
      .sort({ createdAt: -1 })
      .limit(200);

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
    const { decision, condition = 'end_of_month', note = '' } = req.body;

    if (!DECISIONS.includes(decision)) {
      return res.status(400).json({ message: "decision must be 'approve' or 'reject'" });
    }
    if (decision === 'approve' && !CONDITIONS.includes(condition)) {
      return res.status(400).json({ message: 'Invalid leave condition' });
    }
    if (typeof note !== 'string' || note.length > 1000) {
      return res.status(400).json({ message: 'Note must be text of at most 1000 characters' });
    }

    const lr = await LeaveRequest.findById(id).populate({ path: 'booking', populate: { path: 'property', select: 'owner title' } });
    if (!lr) return res.status(404).json({ message: 'Leave request not found' });

    const isAdmin = req.user.role === 'admin';
    const isOwner = lr.owner.toString() === req.user._id.toString();
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Access denied' });
    if (lr.status !== 'pending') return res.status(400).json({ message: 'This request has already been decided' });

    const booking = lr.booking;
    if (!booking) {
      return res.status(409).json({ message: 'The booking for this request no longer exists' });
    }

    if (decision === 'reject') {
      lr.status = 'rejected';
      lr.decisionNote = note;
      await lr.save();

      await notifySafely({
        user: lr.tenant,
        title: 'Leave request rejected',
        message: `Your leave request was rejected.${note ? ` Note: ${note}` : ''}`,
        link: '/leave-requests',
        meta: { leaveRequestId: lr._id, bookingId: booking._id }
      }, 'decideLeaveRequest');

      return res.json({ message: 'Request rejected', data: { leaveRequest: lr } });
    }

    if (booking.status !== 'approved') {
      return res.status(409).json({ message: `The booking is ${booking.status}, so leave can no longer be approved` });
    }

    // Approve: apply the change to the booking first so a failure cannot leave
    // the request marked approved while the booking is unchanged
    const effectiveEndDate = computeEffectiveEndDate(condition, booking);
    const now = new Date();

    if (effectiveEndDate <= booking.startDate) {
      // The stay has not started yet, so leaving means cancelling it
      booking.status = 'cancelled';
    } else {
      if (effectiveEndDate < booking.endDate) {
        booking.endDate = effectiveEndDate;
      }
      if (booking.endDate <= now) {
        booking.status = 'completed';
      }
    }
    await booking.save();
    await updatePropertyAvailability(booking.property._id);

    lr.status = 'approved';
    lr.condition = condition;
    lr.decisionNote = note;
    lr.effectiveEndDate = effectiveEndDate;
    await lr.save();

    await notifySafely({
      user: lr.tenant,
      title: 'Leave request approved',
      message: `Your leave was approved. Effective end date: ${new Date(effectiveEndDate).toLocaleString()}`,
      link: '/leave-requests',
      meta: { leaveRequestId: lr._id, bookingId: booking._id }
    }, 'decideLeaveRequest');

    res.json({ message: 'Request approved', data: { leaveRequest: lr } });
  } catch (error) {
    console.error('decideLeaveRequest error:', error);
    res.status(500).json({ message: 'Server error while deciding leave request' });
  }
};
