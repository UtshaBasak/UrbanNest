import '../config/env.js';
import mongoose from 'mongoose';
import User from '../models/User.js';

// Credentials come from the environment so no secrets live in source control.
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@gmail.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_PHONE = process.env.ADMIN_PHONE || '+1234567890';

const createAdminUser = async () => {
  let exitCode = 0;
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });

    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log('Updated existing user to admin role');
      }
    } else {
      if (!ADMIN_PASSWORD) {
        throw new Error('ADMIN_PASSWORD must be set to create a new admin account');
      }

      const adminUser = new User({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD, // hashed by the User pre-save hook
        phone: ADMIN_PHONE,
        role: 'admin',
        profileImage: ''
      });

      await adminUser.save();
      console.log('Admin user created successfully:', adminUser.email);
    }

    console.log('Admin setup completed');
  } catch (error) {
    console.error('Error setting up admin user:', error.message);
    exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit(exitCode);
  }
};

createAdminUser();
