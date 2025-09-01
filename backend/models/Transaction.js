import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
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
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  // Monthly payment fields
  month: {
    type: Number, // 1-12
    min: 1,
    max: 12
  },
  year: {
    type: Number
  },
  monthName: {
    type: String,
    maxlength: 20
  },
  // For partial payments - track total expected vs paid
  totalExpected: {
    type: Number,
    min: 0,
    default: function() { return this.amount; }
  },
  totalPaid: {
    type: Number,
    min: 0,
    default: function() { return this.status === 'paid' ? this.amount : 0; }
  },
  status: {
    type: String,
    // Support app-required statuses plus legacy ones for compatibility
    enum: ['pending', 'paid', 'unpaid', 'advanced', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  transactionId: {
    type: String,
    unique: true
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'bank_transfer', 'cash'],
    default: 'credit_card'
  },
  paymentDate: {
    type: Date
  },
  description: {
    type: String,
    maxlength: 200
  }
}, {
  timestamps: true
});

// Generate transaction ID before saving
transactionSchema.pre('save', function(next) {
  if (!this.transactionId) {
    this.transactionId = 'TXN' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
  }
  next();
});

export default mongoose.model('Transaction', transactionSchema);