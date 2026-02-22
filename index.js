const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Professional error handler
const errorHandler = (err, req, res, next) => {
    console.error(`[Error] ${err.stack}`);

    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode).json({
        status: 'error',
        message: statusCode === 500 ? 'An internal server error occurred' : err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

const app = express();

// 1. MUST BE FIRST: Trust proxy for Vercel
app.set('trust proxy', 1);

// 2. Database Connection Logic (Serverless optimized)
// Disable buffering so that operations fail fast if not connected
mongoose.set('bufferCommands', false);

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) {
        console.log('Using existing MongoDB connection');
        return;
    }

    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
            dbName: 'fraud_detection_system' // Explicitly set DB name
        });
        console.log('MongoDB Connected successfully');
    } catch (err) {
        console.error('CRITICAL: MongoDB Connection Error:', err.message);
        // Do not throw; let the app live to serve other non-DB routes if any
    }
};

// Initiate connection (Don't await, let it connect in background)
connectDB();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());

// Rate Limiting (Silencing validation for Vercel)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    validate: { trustProxy: false }, // Explicitly disable validation to prevent crash
});
app.use('/api/', limiter);

// Routes
const authRoutes = require('./routes/authRoutes');
const transactionRoutes = require('./routes/transactionRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/transaction', transactionRoutes);

// Root route
app.get('/', (req, res) => {
    res.json({
        status: 'success',
        message: 'Fraud Detection API is active',
        version: '1.0.0'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Middleware
app.use(errorHandler);


module.exports = app;
