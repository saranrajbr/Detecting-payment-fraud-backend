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
        
        # Validation
        if data.amount < 0:
            raise HTTPException(status_code=400, detail="Transaction amount cannot be negative")

        # Simulation logic (matches main.py)
        risk_score = min(max(data.amount / 20000 + np.random.uniform(0, 0.3), 0), 1)
        
        if data.location == 'Unknown' or data.device_type == 'Emulator':
            risk_score += 0.2
            
        risk_score = min(risk_score, 1.0)
        fraud_prediction = 1 if risk_score > 0.7 else 0
        
        logger.info(f"Prediction successful: risk_score={risk_score}")
        return {
            "status": "success",
            "risk_score": float(np.round(risk_score, 4)),
            "fraud_prediction": fraud_prediction
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during prediction")

# Vercel needs the app to be available as 'app'
