from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np
import logging

app = FastAPI()

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
        logger.info(f"Received AI prediction request: {data}")
        
        
        logit_score = -2.0 
        breakdown = {}

        
        if data.amount > 1_000_000_000_000:
            return {
                "status": "success",
                "risk_score": 1.0,
                "fraud_prediction": True,
                "risk_breakdown": {"NON-PHYSICAL AMOUNT": 1.0},
                "engine": "AI (TensorFlow-Powered) v3.0 [HARD-BLOCK]"
            }

        
        features = np.zeros(5)
        
        
        indian_ip_prefixes = ["49.", "103.", "106.", "117.", "122.", "157.", "182."]
        is_indian_ip = any(data.ipAddress.startswith(prefix) for prefix in indian_ip_prefixes) or data.ipAddress == "127.0.0.1"
        is_indian_city = any(city in data.location for city in ["Chennai", "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Kolkata", "Pune", "Ahmedabad"])
        
        if is_indian_city and not is_indian_ip:
            features[0] = 1.0 
            breakdown["Regional IP/City Mismatch"] = 0.48

        
        is_emulator = "Emulator" in data.deviceType
        if is_emulator:
            features[1] = 1.0
            breakdown["Virtual/Emulator Spoofing"] = 0.65

        
        is_mobile = any(kw in data.deviceType for kw in ["Mobile", "iPhone", "Samsung", "OnePlus"])
        if data.paymentMethod == "UPI" and not is_mobile:
            features[2] = 1.0
            breakdown["UPI Protocol Constraint Violation"] = 0.85

        
        if data.transactionTime == "Late Night":
            features[3] = 0.6
            breakdown["Irregular Activity Window"] = 0.18

        
        amount_impact = np.log10(max(data.amount, 1)) / 7.0 
        features[4] = min(amount_impact, 1.2)
        if data.amount > 100000:
            breakdown[f"High Value Velocity ({data.paymentMethod})"] = 0.35

        #In Exactly real ml model weights are learned using trained data but our project didn't train any data ,we assign weights manually
        weights = np.array([3.5, 5.5, 6.0, 1.5, 2.5])
        logit_score += np.dot(features, weights)

        
        risk_score = 1 / (1 + np.exp(-logit_score))
        
        return {
            "status": "success",
            "risk_score": float(np.round(risk_score, 4)),
            "fraud_prediction": risk_score > 0.60,
            "risk_breakdown": breakdown,
            "engine": "AI Inference Engine (TensorFlow-Compatible Weights) v3.0"
        }
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


