const axios = require('axios');

exports.calculateRuleScore = (transaction) => {
    let score = 0;

    // 1. Amount Rule (India context: Higher threshold for routine spends)
    if (transaction.amount > 50000) score += 0.3;

    // 2. India-Focused Geofencing
    const indianCities = ["Chennai", "Mumbai", "Delhi", "Bangalore", "Hyderabad"];
    const isIndianCity = indianCities.some(city => transaction.location.includes(city));

    // IP verification (Basic prefix check)
    const indianIPPrefixes = ["49.", "103.", "106.", "117.", "122.", "157.", "182."];
    const isIndianIP = indianIPPrefixes.some(prefix => transaction.ipAddress?.startsWith(prefix)) || transaction.ipAddress === "127.0.0.1";

    if (isIndianCity && !isIndianIP) {
        score += 0.4; // High risk: Indian city but foreign IP
    }

    // 3. Category Context
    if (transaction.merchantCategory === 'UPI Payment' && transaction.amount > 20000) {
        score += 0.2; // Suspicious: High value UPI (usually used for small-medium)
    }

    // 4. Device Logic
    if (transaction.deviceType === 'Emulator') score += 0.4;

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
