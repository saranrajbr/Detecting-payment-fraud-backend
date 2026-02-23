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
            serverSelectionTimeoutMS: 5000,
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

    // State 1 is "Connected"
    if (state === 1) {
        return next();
    }

    // If URI is missing, fail fast
    if (!process.env.MONGODB_URI) {
        return res.status(500).json({
            error: 'Backend Configuration Error',
            details: 'MONGODB_URI is missing. Please add it to your Vercel Environment Variables.'
        });
    }

    console.log(`[DB Guard] Current state: ${state}. Waiting for connection...`);

    try {
        // If state is 2 (connecting) or 0 (disconnected), wait for it
        await connectDB();

        // Final check after potential wait
        if (mongoose.connection.readyState === 1) {
            console.log('[DB Guard] Connection ready!');
            next();
        } else {
            console.error('[DB Guard] Connection failed to stabilize');
            res.status(503).json({
                error: 'Database connection unstable',
                details: 'The server is currently connecting to the database. Please try again in 5 seconds.'
            });
        }
    } catch (err) {
        console.error('[DB Guard] Middleware Error:', err.message);
        res.status(500).json({ error: 'Internal database connection error' });
    }
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
