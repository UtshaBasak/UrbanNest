import '../config/env.js';
import mongoose from 'mongoose';
import User from '../models/User.js';

// Creates the admin account from environment variables.
//
//   npm run create-admin                      create the admin if the email is unused
//   npm run create-admin -- --force-promote   promote an existing account to admin and
//                                             reset its password to ADMIN_PASSWORD
//
// Promotion is opt-in because anyone can register an account with a given email:
// silently promoting it would hand admin rights to whoever registered it first.
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_PHONE = process.env.ADMIN_PHONE || '+1234567890';
const FORCE_PROMOTE = process.argv.includes('--force-promote');

const createAdminUser = async () => {
  let exitCode = 0;
  try {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in backend/.env');
    }
    if (ADMIN_PASSWORD.length < 8) {
      throw new Error('ADMIN_PASSWORD must be at least 8 characters');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const existing = await User.findOne({ email: ADMIN_EMAIL });

    if (!existing) {
      const adminUser = new User({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD, // hashed by the User pre-save hook
        phone: ADMIN_PHONE,
        role: 'admin',
        profileImage: ''
      });
      await adminUser.save();
      console.log('Admin user created:', adminUser.email);
    } else if (existing.role === 'admin') {
      console.log('Admin user already exists:', existing.email);
    } else if (FORCE_PROMOTE) {
      existing.role = 'admin';
      existing.password = ADMIN_PASSWORD;
      existing.isActive = true;
      await existing.save();
      console.log('Promoted existing account to admin and reset its password:', existing.email);
    } else {
      throw new Error(
        `An account with ${ADMIN_EMAIL} already exists with role "${existing.role}". ` +
        'Re-run with --force-promote to make it an admin (its password will be reset to ADMIN_PASSWORD).'
      );
    }
  } catch (error) {
    console.error('Error setting up admin user:', error.message);
    exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit(exitCode);
  }
};

createAdminUser();
