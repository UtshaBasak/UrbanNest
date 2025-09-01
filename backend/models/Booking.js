import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'],
    default: 'pending'
  },
  message: {
    type: String,
    maxlength: 500
  },
  rejectionReason: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Validate date range
bookingSchema.pre('validate', function(next) {
  // Ensure end strictly after start
  if (this.startDate >= this.endDate) {
    return next(new Error('End date must be after start date'));
  }

  // Allow same-day bookings by comparing date-only (truncate time)
  const startDay = new Date(this.startDate);
  startDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (startDay < today) {
    return next(new Error('Start date cannot be in the past'));
  }
  next();
});

export default mongoose.model('Booking', bookingSchema);