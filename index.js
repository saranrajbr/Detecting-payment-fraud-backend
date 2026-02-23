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
// Enable buffering for reliability
mongoose.set('bufferCommands', true);

const connectDB = async () => {
    if (!process.env.MONGODB_URI) {
        console.error('CRITICAL: MONGODB_URI is not defined in environment variables!');
        return;
    }

    if (mongoose.connection.readyState >= 1) return;

    try {
        const maskedUri = process.env.MONGODB_URI.replace(/\/\/.*@/, '//****:****@');
        console.log(`Connecting to MongoDB (${maskedUri})...`);

        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 15000, // increased from 5s for Vercel cold starts
            socketTimeoutMS: 30000,
            dbName: 'fraud_detection_system'
        });
        console.log('MongoDB Connected successfully');
    } catch (err) {
        console.error('CRITICAL: MongoDB Connection Error:', err.message);
    }
};

// 3. Database Guard Middleware
const dbMiddleware = async (req, res, next) => {
    const state = mongoose.connection.readyState;
    if (state === 1) return next();

    if (!process.env.MONGODB_URI) {
        return res.status(500).json({
            error: 'Backend Configuration Error',
            details: 'MONGODB_URI is missing.'
        });
    }

    // Retry up to 3 times with 2s delay (handles Vercel cold-start)
    for (let i = 0; i < 3; i++) {
        try { await connectDB(); } catch (e) { /* ignore */ }
        if (mongoose.connection.readyState === 1) return next();
        await new Promise(r => setTimeout(r, 2000));
        console.log(`[DB Guard] Retry ${i + 1}/3...`);
    }

    console.error('[DB Guard] Connection failed after retries');
    res.status(503).json({
        error: 'Service temporarily unavailable',
        details: 'Database is starting up. Please retry in a few seconds.'
    });
};

// Initiate connection
connectDB();

// Middleware
app.use(cors()); // Enable CORS for all origins (or you can specify origin: 'https://saranrajbr.github.io')
app.use(helmet());
app.use(express.json());
app.use(dbMiddleware); // Force all requests to wait for DB

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
