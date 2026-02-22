from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np
import logging

# Note: TensorFlow is heavy for Vercel functions (250MB limit). 
# If it exceeds, we might need to use a lighter alternative or optimize.
# For now, I'll keep the logic consistent with original main.py.

app = FastAPI()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TransactionData(BaseModel):
    amount: float
    time: str
    location: str
    device_type: str
    merchant_category: str
    ip_address: str
    payment_method: str = "UPI"
    transaction_time: str = "Noon"

@app.post("/api/ml/predict")
async def predict(data: TransactionData):
    try:
        logger.info(f"Received prediction request: {data}")
        
        breakdown = {}
        total_risk = 0.0

        # 1. Geolocation Logic
        indian_ip_prefixes = ["49.", "103.", "106.", "117.", "122.", "157.", "182."]
        is_indian_ip = any(data.ip_address.startswith(prefix) for prefix in indian_ip_prefixes) or data.ip_address == "127.0.0.1"
        is_indian_city = any(city in data.location for city in ["Chennai", "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Kolkata", "Pune", "Ahmedabad"])
        
        if is_indian_city and not is_indian_ip:
            breakdown["Geo-Mismatch (City vs IP)"] = 0.45
            total_risk += 0.45
        elif not is_indian_city and is_indian_ip:
            breakdown["Foreign Transaction / Indian IP"] = 0.25
            total_risk += 0.25

        # 2. Amount & Payment Method Logic
        if data.payment_method == "UPI" and data.amount > 50000:
            breakdown["High-Value UPI Scan"] = 0.20
            total_risk += 0.20
        elif data.payment_method in ["Visa", "Mastercard"] and is_indian_ip and not is_indian_city:
            breakdown["International Card / Unrecognized Node"] = 0.30
            total_risk += 0.30

        # 3. Time of Day Logic (Late Night is higher risk)
        if data.transaction_time == "Late Night":
            breakdown["Unusual Hours (1 AM - 4 AM)"] = 0.15
            total_risk += 0.15

        # 4. Device Logic
        if data.device_type == 'Emulator':
            breakdown["Suspicious Device (Emulator)"] = 0.35
            total_risk += 0.35

        # 5. Base Risk (Amount scaling)
        base_amt_risk = min(data.amount / 200000, 0.2)
        if base_amt_risk > 0.05:
            breakdown["Large Transaction Volume"] = float(np.round(base_amt_risk, 2))
            total_risk += base_amt_risk

        risk_score = min(max(total_risk, 0), 1.0)
        fraud_prediction = 1 if risk_score > 0.65 else 0
        
        return {
            "status": "success",
            "risk_score": float(np.round(risk_score, 4)),
            "fraud_prediction": fraud_prediction,
            "risk_breakdown": breakdown,
            "india_context": {
                "is_indian_ip": is_indian_ip,
                "is_indian_city": is_indian_city
            }
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during prediction")

# Vercel needs the app to be available as 'app'
