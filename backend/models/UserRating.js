import mongoose from 'mongoose';

const userRatingSchema = new mongoose.Schema({
  ratee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  rater: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  context: {
    type: String,
    enum: ['owner', 'tenant'],
    required: true,
    index: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    maxlength: 500,
    default: '',
  },
}, { timestamps: true });

// Prevent duplicate ratings by the same rater on the same ratee for a given context
userRatingSchema.index({ ratee: 1, rater: 1, context: 1 }, { unique: true });

export default mongoose.model('UserRating', userRatingSchema);
