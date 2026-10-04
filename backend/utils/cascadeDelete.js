import User from '../models/User.js';
import Property from '../models/Property.js';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import Notification from '../models/Notification.js';
import UserRating from '../models/UserRating.js';
import LeaveRequest from '../models/LeaveRequest.js';

// Hard-delete a user together with every document that references them.
// Must be called inside a MongoDB transaction (session.withTransaction).
export const deleteUserCascade = async (user, session) => {
  const userId = user._id;

  let propertyIds = [];
  if (user.role === 'owner') {
    const properties = await Property.find({ owner: userId }, '_id').session(session);
    propertyIds = properties.map((p) => p._id);
  }

  const relatedToUser = user.role === 'owner'
    ? { $or: [{ tenant: userId }, { property: { $in: propertyIds } }] }
    : { tenant: userId };

  // Operations run sequentially: a transaction session does not support parallel operations.
  if (propertyIds.length) {
    await Property.deleteMany({ _id: { $in: propertyIds } }).session(session);
  }
  await Booking.deleteMany(relatedToUser).session(session);
  await Review.deleteMany(relatedToUser).session(session);
  await LeaveRequest.deleteMany({ $or: [{ tenant: userId }, { owner: userId }] }).session(session);
  await Notification.deleteMany({ user: userId }).session(session);
  await UserRating.deleteMany({ $or: [{ rater: userId }, { ratee: userId }] }).session(session);

  // Remove this owner and their properties from other users' favourites
  const favouriteIds = [userId, ...propertyIds];
  await User.updateMany(
    { 'favourites.itemId': { $in: favouriteIds } },
    { $pull: { favourites: { itemId: { $in: favouriteIds } } } }
  ).session(session);

  await User.deleteOne({ _id: userId }).session(session);
};
