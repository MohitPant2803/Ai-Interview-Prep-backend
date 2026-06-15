import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import reportsRoutes from './routes/reports.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/reports', reportsRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Database Connection & Server Launch
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.warn('WARNING: MONGO_URI environment variable is missing. Database operations will fail.');
}

mongoose.connect(MONGO_URI || 'mongodb://localhost:27017/online_interviewer')
  .then(() => {
    console.log('Successfully connected to MongoDB Atlas.');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB Atlas Connection Error:', err);
    console.log(`Fallback: Starting server on port ${PORT} without active database connection.`);
    app.listen(PORT, () => {
      console.log(`Server started on port ${PORT} (DB Connection Offline)`);
    });
  });
