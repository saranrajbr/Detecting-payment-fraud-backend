const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    time: { type: Date, default: Date.now },
    location: { type: String, required: true },
    deviceType: { type: String, required: true },
    merchantCategory: { type: String, required: true },
    ipAddress: { type: String, required: true },
    mlRiskScore: { type: Number, default: 0 },
    ruleRiskScore: { type: Number, default: 0 },
    finalRiskScore: { type: Number, default: 0 },
    isFraud: { type: Boolean, default: false },
    actionTaken: { type: String, enum: ['Approve', 'OTP', 'Block'], default: 'Approve' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', transactionSchema);
