import mongoose from 'mongoose';

const propertySchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    trim: true
  },
  description: {
    type: String
  },
  location: {
    type: String
  },
  latitude: {
    type: Number
  },
  longitude: {
    type: Number
  },
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  price: {
    type: Number,
    min: 0
  },
  bedrooms: {
    type: Number
  },
  bathrooms: {
    type: Number
  },
  area: {
    type: Number,
    min: 0
  },
  // Frontend uses `size` as well; keep both for compatibility
  size: {
    type: Number,
    min: 0
  },
  propertyType: {
    type: String,
    enum: ['apartment', 'house', 'condo', 'villa', 'studio'],
  },
  // Frontend uses `type` field; keep a relaxed enum
  type: {
    type: String,
    enum: ['Apartment', 'House', 'Studio', 'Condo', 'Villa']
  },
  images: [{
    type: String
  }],
  amenities: [{
    type: String
  }],
  availabilityStatus: {
    type: String,
    enum: ['Available', 'Booked', 'Not Available'],
    default: 'Available'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for geospatial queries
propertySchema.index({ 'coordinates.latitude': 1, 'coordinates.longitude': 1 });
propertySchema.index({ price: 1, bedrooms: 1, availabilityStatus: 1 });

export default mongoose.model('Property', propertySchema);