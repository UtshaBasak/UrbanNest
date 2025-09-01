import mongoose from 'mongoose';

const leaveRequestSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    message: {
      type: String,
      maxlength: 1000,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    condition: {
      // Set by owner when approving
      type: String,
      enum: ['immediate', 'end_of_month', 'end_of_current_booking', 'end_of_next_month', null],
      default: null,
    },
    decisionNote: {
      type: String,
      maxlength: 1000,
      default: '',
    },
    effectiveEndDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model('LeaveRequest', leaveRequestSchema);
