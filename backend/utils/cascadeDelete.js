import User from '../models/User.js';
import Property from '../models/Property.js';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import Notification from '../models/Notification.js';
import UserRating from '../models/UserRating.js';
import LeaveRequest from '../models/LeaveRequest.js';

// All helpers below must be called inside a MongoDB transaction (session.withTransaction).
// Operations run sequentially: a transaction session does not support parallel operations.

// Hard-delete properties together with their bookings, leave requests, reviews and favourites.
export const deletePropertiesCascade = async (propertyIds, session) => {
  if (!propertyIds.length) return;

  const bookingIds = await Booking.find({ property: { $in: propertyIds } }).session(session).distinct('_id');
  if (bookingIds.length) {
    await LeaveRequest.deleteMany({ booking: { $in: bookingIds } }).session(session);
    await Booking.deleteMany({ _id: { $in: bookingIds } }).session(session);
  }
  await Review.deleteMany({ property: { $in: propertyIds } }).session(session);
  await User.updateMany(
    { 'favourites.itemId': { $in: propertyIds } },
    { $pull: { favourites: { itemId: { $in: propertyIds } } } }
  ).session(session);
  await Property.deleteMany({ _id: { $in: propertyIds } }).session(session);
};

// Hard-delete a user together with every document that references them.
export const deleteUserCascade = async (user, session) => {
  const userId = user._id;

  // Look up properties regardless of the current role: an owner may have switched to tenant
  const propertyIds = await Property.find({ owner: userId }).session(session).distinct('_id');
  await deletePropertiesCascade(propertyIds, session);

  // The user's own bookings as a tenant, plus any leave requests attached to them
  const tenantBookingIds = await Booking.find({ tenant: userId }).session(session).distinct('_id');
  await LeaveRequest.deleteMany({
    $or: [{ tenant: userId }, { owner: userId }, { booking: { $in: tenantBookingIds } }]
  }).session(session);
  await Booking.deleteMany({ tenant: userId }).session(session);

  await Review.deleteMany({ tenant: userId }).session(session);
  await Notification.deleteMany({ user: userId }).session(session);
  await UserRating.deleteMany({ $or: [{ rater: userId }, { ratee: userId }] }).session(session);

  // Remove this user from other users' favourites
  await User.updateMany(
    { 'favourites.itemId': userId },
    { $pull: { favourites: { itemId: userId } } }
  ).session(session);

  await User.deleteOne({ _id: userId }).session(session);
};
