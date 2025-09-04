import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: 'admin@gmail.com' });
    
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log('Updated existing user to admin role');
      }
    } else {
      // Create admin user
      const adminUser = new User({
        name: 'Admin User',
        email: 'admin@gmail.com',
        password: 'admin123', // This will be hashed by the pre-save middleware
        phone: '+1234567890',
        role: 'admin',
        profileImage: ''
      });

      await adminUser.save();
      console.log('Admin user created successfully:', adminUser.email);
    }

    console.log('Admin setup completed');
    
  } catch (error) {
    console.error('Error setting up admin user:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

createAdminUser();
