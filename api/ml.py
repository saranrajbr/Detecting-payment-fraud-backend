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
    location: str
    deviceType: str
    merchantCategory: str
    ipAddress: str
    paymentMethod: str
    transactionTime: str

def sigmoid(x):
    return 1 / (1 + np.exp(-x))

@app.post("/api/ml/predict")
async def predict(data: TransactionData):
    try:
        logger.info(f"Received prediction request: {data}")
        
        # Base risk level (Logit scale)
        # 0 in logit = 0.5 in sigmoid (neutral)
        logit_score = -1.5 # Bias towards low risk
        
        breakdown = {}

        # 1. Geolocation Logic
        indian_ip_prefixes = ["49.", "103.", "106.", "117.", "122.", "157.", "182."]
        is_indian_ip = any(data.ipAddress.startswith(prefix) for prefix in indian_ip_prefixes) or data.ipAddress == "127.0.0.1"
        is_indian_city = any(city in data.location for city in ["Chennai", "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Kolkata", "Pune", "Ahmedabad"])
        
        if is_indian_city and not is_indian_ip:
            logit_score += 3.0
            breakdown["Geo-Mismatch (City vs IP)"] = 0.45
            
        # 2. Impossible Combinations (Context Rules)
        is_mobile = any(keyword in data.deviceType for keyword in ["Mobile", "iPhone", "Samsung", "OnePlus"])
        if data.paymentMethod == "UPI" and not is_mobile:
            logit_score += 4.5
            breakdown["Impossible Context (UPI on Desktop)"] = 0.50

        # 3. High Value & Method Sensitivity
        if data.paymentMethod == "UPI" and data.amount > 50000:
            logit_score += 2.0
            breakdown["High Value UPI (>50k)"] = 0.25
        elif data.amount > 200000:
            logit_score += 1.5
            breakdown["Extreme Transaction Amount"] = 0.20

        # 4. Temporal Analysis
        if data.transactionTime == "Late Night":
            logit_score += 1.2
            breakdown["Late Night Activity (Risk Window)"] = 0.15

        # 5. Native Device Check
        if "Emulator" in data.deviceType:
            logit_score += 5.0
            breakdown["Virtual/Emulator Device"] = 0.60

        # Map logit to final probability (0.0 to 1.0)
        risk_score = sigmoid(logit_score)
        fraud_prediction = risk_score > 0.65
        
        return {
            "status": "success",
            "risk_score": float(np.round(risk_score, 4)),
            "fraud_prediction": bool(fraud_prediction),
            "risk_breakdown": breakdown,
            "engine": "Proper Realistic Scoring v2.0"
        }
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Vercel needs the app to be available as 'app'
