import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import userRouter from './routes/user.route.js';
import authRouter from './routes/authRoutes.js';

mongoose.connect(process.env.MONGO).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

const app = express();

app.listen(3000, () => {
  console.log('Server is running on port 3000!');
});

app.use('/backend/user', userRouter);
app.use('/backend/auth', authRouter);
