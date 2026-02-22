const axios = require('axios');

exports.calculateRuleScore = (transaction) => {
    let score = 0;
    // Rule 1: High amount
    if (transaction.amount > 10000) score += 0.4;

    // Rule 2: Suspicious location (Simulation)
    const suspiciousLocations = ['Unknown', 'HighRiskZone'];
    if (suspiciousLocations.includes(transaction.location)) score += 0.3;

    // Rule 3: Device type (Simulation)
    if (transaction.deviceType === 'Emulator') score += 0.3;

    return Math.min(score, 1);
};

exports.getMLRiskScore = async (transaction) => {
    try {
        // In local dev with vercel dev, or production, /api/ml is routed correctly.
        // We use the environment variable if defined, otherwise fallback to local/relative.
        const mlUrl = process.env.ML_SERVICE_URL || '';
        const response = await axios.post(`${mlUrl}/api/ml/predict`, {
            amount: transaction.amount,
            time: transaction.time,
            location: transaction.location,
            device_type: transaction.deviceType,
            merchant_category: transaction.merchantCategory,
            ip_address: transaction.ipAddress
        });
        return response.data.risk_score;
    } catch (err) {
        console.error('ML Service Error:', err.message);
        return 0.5; // Default fallback risk if ML service is down
    }
};
