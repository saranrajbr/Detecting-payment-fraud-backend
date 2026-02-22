const axios = require('axios');

exports.calculateRuleScore = (transaction) => {
    let score = 0;

    // 1. Amount Rule (Severe penalty for high consumer transactions)
    if (transaction.amount > 50000) score += 0.4;
    if (transaction.amount > 200000) score += 0.2;

    // 2. India-Focused Geofencing (Aggressive)
    const indianCities = ["Chennai", "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Kolkata", "Pune", "Ahmedabad"];
    const isIndianCity = indianCities.some(city => transaction.location?.includes(city));

    // IP verification
    const indianIPPrefixes = ["49.", "103.", "106.", "117.", "122.", "157.", "182."];
    const isIndianIP = indianIPPrefixes.some(prefix => transaction.ipAddress?.startsWith(prefix)) || transaction.ipAddress === "127.0.0.1";

    if (isIndianCity && !isIndianIP) {
        score += 0.5; // Critical Mismatch: Local City, Global IP
    }

    // 3. Category Context (UPI is high speed, high risk)
    if (transaction.paymentMethod === 'UPI' && transaction.amount > 20000) {
        score += 0.3;
    }

    // 4. Device Integrity
    if (transaction.deviceType?.includes('Emulator')) score += 0.6;

    return Math.min(score, 1);
};

exports.getMLRiskScore = async (transaction) => {
    try {
        const mlUrl = process.env.ML_SERVICE_URL;

        // 1. Validate URL
        if (!mlUrl || mlUrl.trim() === "") {
            console.warn('⚠️ ML_SERVICE_URL is not defined. Using fallback neutral score.');
            return { risk_score: 0.5, risk_breakdown: { "System": "ML Service Offline/Not Configured" } };
        }

        // 2. Call ML Service
        const response = await axios.post(`${mlUrl}/api/ml/predict`, {
            amount: transaction.amount,
            location: transaction.location,
            deviceType: transaction.deviceType,
            merchantCategory: transaction.merchantCategory,
            ipAddress: transaction.ipAddress,
            paymentMethod: transaction.paymentMethod,
            transactionTime: transaction.transactionTime
        }, { timeout: 4000 }); // 4s timeout for ML response

        return response.data;
    } catch (err) {
        console.error('❌ ML Service Error:', err.message);
        return {
            risk_score: 0.5,
            risk_breakdown: { "Error": "ML analysis unavailable" },
            error_details: err.message
        };
    }
};
