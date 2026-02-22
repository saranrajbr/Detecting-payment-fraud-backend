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

@app.post("/api/ml/predict")
async def predict(data: TransactionData):
    try:
        logger.info(f"Received prediction request: {data}")
        
        # 1. Indian IP Geolocation Simulation
        indian_ip_prefixes = ["49.", "103.", "106.", "117.", "122.", "157.", "182."]
        is_indian_ip = any(data.ip_address.startswith(prefix) for prefix in indian_ip_prefixes) or data.ip_address == "127.0.0.1"
        
        # 2. Risk Calculation Base
        # Base risk from amount (scaled to Indian context, e.g., higher threshold than USD)
        base_risk = min(data.amount / 100000, 0.4) 
        
        # 3. Geo-Fencing (Critical for India Focus)
        geo_risk = 0
        is_indian_city = any(city in data.location for city in ["Chennai", "Mumbai", "Delhi", "Bangalore", "Hyderabad"])
        
        if is_indian_city and not is_indian_ip:
            # High risk: Indian city but IP is foreign
            geo_risk = 0.5
            logger.warning(f"Geo-Mismatch: {data.location} combined with non-Indian IP {data.ip_address}")
        elif not is_indian_city and is_indian_ip:
            # Suspicious: Foreign city but Indian IP
            geo_risk = 0.3

        # 4. Device/Static Rules
        device_risk = 0.3 if data.device_type == 'Emulator' else 0
        
        # 5. Final Score Assembly
        total_risk = base_risk + geo_risk + device_risk + np.random.uniform(0, 0.1)
        risk_score = min(max(total_risk, 0), 1.0)
        
        fraud_prediction = 1 if risk_score > 0.65 else 0
        
        logger.info(f"Prediction successful: risk_score={risk_score}")
        return {
            "status": "success",
            "risk_score": float(np.round(risk_score, 4)),
            "fraud_prediction": fraud_prediction,
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
