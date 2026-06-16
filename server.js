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

// Database Connection — cache the connection promise to avoid reconnecting on every serverless invocation
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.warn('WARNING: MONGO_URI environment variable is missing. Database operations will fail.');
}

let cachedConnection = null;
async function connectDB() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }
  
  console.log('Connecting to MongoDB...');
  cachedConnection = await mongoose.connect(MONGO_URI || 'mongodb://localhost:27017/online_interviewer', {
    serverSelectionTimeoutMS: 5000,
  });
  console.log('Successfully connected to MongoDB.');
  return cachedConnection;
}

// Middleware
app.use(cors());
app.use(express.json());

// Database connection middleware to ensure DB is connected before any request is processed
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection error in middleware:', err.message);
    res.status(500).json({ error: 'Database connection failed', details: err.message });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/reports', reportsRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date(), dbState: mongoose.connection.readyState });
});

// Start local dev server if not running on Vercel
if (!process.env.VERCEL) {
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('MongoDB Atlas Connection Error:', err.message);
      console.log(`Fallback: Starting server on port ${PORT} without active database connection.`);
      app.listen(PORT, () => {
        console.log(`Server started on port ${PORT} (DB Connection Offline)`);
      });
    });
}

// Export for Vercel serverless
export default app;
