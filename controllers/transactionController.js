const Transaction = require('../models/Transaction');
const { calculateRuleScore, getMLRiskScore } = require('../services/fraudService');

exports.createTransaction = async (req, res) => {
    try {
        const transactionData = { ...req.body, userId: req.user.id };

        // 1. Get Scores
        const mlRiskScore = await getMLRiskScore(transactionData);
        const ruleRiskScore = calculateRuleScore(transactionData);

        // 2. Final Risk Score Calculation
        // Final Risk Score = (ML Risk Score * 0.7) + (Rule-Based Score * 0.3)
        const finalRiskScore = (mlRiskScore * 0.7) + (ruleRiskScore * 0.3);

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
        res.status(201).json(transaction);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getTransactions = async (req, res) => {
    try {
        const query = req.user.role === 'admin' ? {} : { userId: req.user.id };
        const transactions = await Transaction.find(query).sort({ createdAt: -1 });
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getStats = async (req, res) => {
    try {
        const totalTransactions = await Transaction.countDocuments();
        const fraudulentTransactions = await Transaction.countDocuments({ isFraud: true });
        const fraudRate = totalTransactions > 0 ? (fraudulentTransactions / totalTransactions) * 100 : 0;

        res.json({
            totalTransactions,
            fraudulentTransactions,
            fraudRate: fraudRate.toFixed(2)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
