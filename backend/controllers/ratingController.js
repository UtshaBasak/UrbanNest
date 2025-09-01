import User from '../models/User.js';
import Booking from '../models/Booking.js';
import UserRating from '../models/UserRating.js';

// Helper: verify rater is allowed to rate ratee under context (no edits allowed; only first-time)
async function canRate(raterId, rateeId, context) {
  if (!raterId || !rateeId || raterId.toString() === rateeId.toString()) return false;
  // must have an active or completed booking connecting them
  const match = await Booking.findOne({
    status: { $in: ['approved', 'completed'] },
    tenant: context === 'tenant' ? rateeId : raterId, // when rating tenant, ratee is tenant
  }).populate({ path: 'property', select: 'owner', match: { owner: context === 'owner' ? rateeId : raterId } });
  return !!(match && match.property);
}

// @desc Create or update a user rating (allows updating an existing rating)
// @route POST /api/ratings
// @access Private
export const createRating = async (req, res) => {
  try {
    const { rateeId, rating, comment = '', context } = req.body;
    if (!rateeId || !rating || !context) {
      return res.status(400).json({ message: 'rateeId, rating, and context are required' });
    }
    if (!['owner', 'tenant'].includes(context)) {
      return res.status(400).json({ message: 'Invalid context' });
    }
    const raterId = req.user.id || req.user._id;

    // Validate allowed relation (must have an approved booking linking rater and ratee)
    const ok = await canRate(raterId, rateeId, context);
    if (!ok) return res.status(403).json({ message: 'Not allowed to rate this user' });

    // Create or update existing rating by this rater for this ratee/context
    const existing = await UserRating.findOne({ ratee: rateeId, rater: raterId, context });
    const updated = await UserRating.findOneAndUpdate(
      { ratee: rateeId, rater: raterId, context },
      { $set: { rating, comment } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    const status = existing ? 200 : 201;
    res.status(status).json({ data: { rating: updated, updated: !!existing } });
  } catch (error) {
    console.error('Create rating error:', error);
    res.status(500).json({ message: 'Server error while creating rating' });
  }
};

// @desc Check if current user can rate target user for a context
// @route GET /api/ratings/can-rate?rateeId=&context=
// @access Private
export const canRateCheck = async (req, res) => {
  try {
    const { rateeId, context } = req.query;
    if (!rateeId || !context) {
      return res.status(400).json({ message: 'rateeId and context are required' });
    }
    if (!['owner', 'tenant'].includes(context)) {
      return res.status(400).json({ message: 'Invalid context' });
    }
    const raterId = req.user.id || req.user._id;
    const ok = await canRate(raterId, rateeId, context);
    return res.json({ data: { canRate: !!ok } });
  } catch (error) {
    console.error('canRateCheck error:', error);
    res.status(500).json({ message: 'Server error while checking rating permission' });
  }
};

// @desc Get rating summary for a user
// @route GET /api/ratings/:userId/summary
// @access Public
export const getRatingSummary = async (req, res) => {
  try {
    const userId = req.params.userId;
    const groups = await UserRating.aggregate([
      { $match: { ratee: UserRating.db.base.Types.ObjectId.createFromHexString(userId) } },
      { $group: { _id: '$context', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    const summary = { owner: { avg: 0, count: 0 }, tenant: { avg: 0, count: 0 } };
    for (const g of groups) {
      if (g._id === 'owner') { summary.owner = { avg: g.avg || 0, count: g.count || 0 }; }
      if (g._id === 'tenant') { summary.tenant = { avg: g.avg || 0, count: g.count || 0 }; }
    }
    res.json({ data: { summary } });
  } catch (error) {
    console.error('Get rating summary error:', error);
    res.status(500).json({ message: 'Server error while fetching rating summary' });
  }
};

// @desc List ratings for a user (optional)
// @route GET /api/ratings/:userId
// @access Public
export const listRatings = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.params.userId;
    const ratings = await UserRating.find({ ratee: userId })
      .populate('rater', 'name profileImage role')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
    const total = await UserRating.countDocuments({ ratee: userId });
    res.json({ data: { ratings, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } } });
  } catch (error) {
    console.error('List ratings error:', error);
    res.status(500).json({ message: 'Server error while listing ratings' });
  }
};

// @desc Delete user rating
// @route DELETE /api/ratings/:id
// @access Private (Rating author, Admin)
export const deleteRating = async (req, res) => {
  try {
    const rating = await UserRating.findById(req.params.id);

    if (!rating) {
      return res.status(404).json({ message: 'Rating not found' });
    }

    // Check permissions: rating author or admin
    const isAuthor = rating.rater.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await UserRating.findByIdAndDelete(req.params.id);

    res.json({ message: 'Rating deleted successfully', data: { id: req.params.id } });

  } catch (error) {
    console.error('Delete rating error:', error);
    res.status(500).json({ message: 'Server error while deleting rating' });
  }
};
