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
bookingSchema.pre('validate', function() {
  // Only check dates when they are set or changed, so existing bookings that have
  // already started can still be cancelled, decided or shortened
  const datesChanged = this.isNew || this.isModified('startDate') || this.isModified('endDate');
  if (datesChanged && this.startDate >= this.endDate) {
    throw new Error('End date must be after start date');
  }

  // New bookings cannot start in the past (same-day bookings are allowed)
  if (this.isNew || this.isModified('startDate')) {
    const startDay = new Date(this.startDate);
    startDay.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDay < today) {
      throw new Error('Start date cannot be in the past');
    }
  }
});

export default mongoose.model('Booking', bookingSchema);