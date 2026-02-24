const axios = require('axios');

exports.calculateRuleScore = (transaction) => {
    let score = 0;

    
    if (transaction.amount > 50000) score += 0.4;
    if (transaction.amount > 200000) score += 0.2;

    
    const indianCities = ["Chennai", "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Kolkata", "Pune", "Ahmedabad"];
    const isIndianCity = indianCities.some(city => transaction.location?.includes(city));

    
    const indianIPPrefixes = ["49.", "103.", "106.", "117.", "122.", "157.", "182."];
    const isIndianIP = indianIPPrefixes.some(prefix => transaction.ipAddress?.startsWith(prefix)) || transaction.ipAddress === "127.0.0.1";

    if (isIndianCity && !isIndianIP) {
        score += 0.5; 
    }

    
    if (transaction.paymentMethod === 'UPI' && transaction.amount > 20000) {
        score += 0.3;
    }

    
    if (transaction.deviceType?.includes('Emulator')) score += 0.6;

    return Math.min(score, 1);
};

exports.getMLRiskScore = async (transaction) => {
    try {
        const baseUrl =
        process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000";

    const response = await axios.post(
        `${baseUrl}/api/ml/predict`,
        {
            amount: transaction.amount,
            location: transaction.location,
            deviceType: transaction.deviceType,
            merchantCategory: transaction.merchantCategory,
            ipAddress: transaction.ipAddress,
            paymentMethod: transaction.paymentMethod,
            transactionTime: transaction.transactionTime
        },
        { timeout: 4000 }
    );

        return response.data;
    } catch (err) {
        console.error('❌ ML Service Error:', err.message);
        return {
            risk_score: 0.3,
            risk_breakdown: { "Error": "ML analysis unavailable" },
            error_details: err.message
        };
    }
};
