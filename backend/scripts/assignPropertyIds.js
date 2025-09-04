import mongoose from 'mongoose';
import Property from '../models/Property.js';
import { config } from 'dotenv';

// Load environment variables
config();

// Function to generate unique 8-character alphanumeric ID
const generateUniquePropertyId = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let propertyId;
  let isUnique = false;
  
  while (!isUnique) {
    propertyId = '';
    for (let i = 0; i < 8; i++) {
      propertyId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Check if this ID already exists
    const existingProperty = await Property.findOne({ propertyId });
    if (!existingProperty) {
      isUnique = true;
    }
  }
  
  return propertyId;
};

const assignPropertyIds = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/urbannest';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Find all properties without propertyId
    const propertiesWithoutId = await Property.find({ 
      $or: [
        { propertyId: { $exists: false } },
        { propertyId: null },
        { propertyId: '' }
      ]
    });

    console.log(`Found ${propertiesWithoutId.length} properties without propertyId`);

    let updated = 0;
    for (const property of propertiesWithoutId) {
      try {
        const propertyId = await generateUniquePropertyId();
        await Property.findByIdAndUpdate(property._id, { propertyId });
        console.log(`Assigned ID ${propertyId} to property: ${property.title || property._id}`);
        updated++;
      } catch (error) {
        console.error(`Error updating property ${property._id}:`, error.message);
      }
    }

    console.log(`Successfully assigned propertyId to ${updated} properties`);
    
  } catch (error) {
    console.error('Error in assignPropertyIds:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the script
assignPropertyIds();
