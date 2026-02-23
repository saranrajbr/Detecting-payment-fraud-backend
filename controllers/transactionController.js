const Transaction = require('../models/Transaction');
const { calculateRuleScore, getMLRiskScore } = require('../services/fraudService');

exports.createTransaction = async (req, res, next) => {
    try {
        const transactionData = { ...req.body, userId: req.user.id };

        // 1. Get Scores
        const mlResponse = await getMLRiskScore(transactionData);
        const mlRiskScore = mlResponse.risk_score || 0.3;
        const riskBreakdown = mlResponse.risk_breakdown || {};

        const ruleRiskScore = calculateRuleScore(transactionData);

        // 2. Final Risk Score Calculation (Hybrid Recalibration v3.2)
        // Adjust weight to allow rules to trigger high risk if ML is missing/neutral
        const finalRiskScore = (mlRiskScore * 0.4) + (ruleRiskScore * 0.6);

        // Debug Log for Persistence
        console.log(`[Storage] Processing transaction for User: ${req.user.id}, Amount: ${transactionData.amount}, Mobile: ${transactionData.mobileNumber}`);

        // 3. Decision Logic
        let actionTaken = 'Approve';
        let isFraud = false;

        if (finalRiskScore > 0.7) {
            actionTaken = 'Block';
            isFraud = true;
        } else if (finalRiskScore > 0.4) {
            actionTaken = 'OTP';
        }

        const transaction = new Transaction({
            ...transactionData,
            mlRiskScore,
            ruleRiskScore,
            finalRiskScore,
            isFraud,
            actionTaken
        });

        await transaction.save();
        res.status(201).json({
            ...transaction._doc,
            mlBreakdown: riskBreakdown
        });
    } catch (err) {
        next(err);
    }
};

exports.getTransactions = async (req, res, next) => {
    try {
        let query = {};
        if (req.user.role !== 'admin') {
            query.userId = req.user.id;
        }

        const transactions = await Transaction.find(query)
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .limit(50);

        res.json(transactions);
    } catch (err) {
        next(err);
    }
};

exports.getStats = async (req, res, next) => {
    try {
        let query = {};
        if (req.user.role !== 'admin') {
            query.userId = req.user.id;
        }

        const totalTransactions = await Transaction.countDocuments(query);
        const fraudulentTransactions = await Transaction.countDocuments({ ...query, isFraud: true });
        const fraudRate = totalTransactions > 0 ? (fraudulentTransactions / totalTransactions) * 100 : 0;

        res.json({
            totalTransactions,
            fraudulentTransactions,
            fraudRate: fraudRate.toFixed(2)
        });
    } catch (err) {
        next(err);
    }
};
