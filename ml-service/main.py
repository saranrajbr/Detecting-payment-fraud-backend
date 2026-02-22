
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np
import tensorflow as tf
import time

app = FastAPI()

# Simulated model or load if available
# model = tf.keras.models.load_model('model.h5')

import logging
print("hello")
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

@app.post("/predict")
async def predict(data: TransactionData):
    try:
        logger.info(f"Received prediction request: {data}")
        
        # Validation
        if data.amount < 0:
            raise HTTPException(status_code=400, detail="Transaction amount cannot be negative")

        # For simulation, we calculate a pseudo-risk based on amount and some random noise
        # In a real scenario, this would be model.predict()
        risk_score = min(max(data.amount / 20000 + np.random.uniform(0, 0.3), 0), 1)
        
        # Suspicious logic for simulation
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
