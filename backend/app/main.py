import os
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List
from backend.app.core.engine import analyze_submission

app = FastAPI(title="Astra API")

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STORAGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage"))
ASSIGNMENT_DIR = os.path.join(STORAGE_DIR, "assignments", "assignment_1")
AI_VAULT_DIR = os.path.join(ASSIGNMENT_DIR, "ai_vault")

class CompareRequest(BaseModel):
    student_code: str
    assignment_id: str = "assignment_1"
    sieve_threshold: float = 0.10
    force: bool = False

@app.get("/")
def read_root():
    return {"message": "Astra Backend API is active"}

@app.get("/api/assignments")
def get_assignments():
    """
    Returns the metadata of all assignments and their associated AI vaults.
    """
    if not os.path.exists(AI_VAULT_DIR):
        return []
        
    ai_models = {}
    for filename in os.listdir(AI_VAULT_DIR):
        if filename.endswith(".cpp"):
            model_key = filename.replace("reference_", "").replace(".cpp", "")
            filepath = os.path.join(AI_VAULT_DIR, filename)
            with open(filepath, "r") as f:
                code_content = f.read()
                
            model_display = {
                "gpt4o": "GPT-4o",
                "claude35": "Claude 3.5",
                "gemini15": "Gemini 1.5",
                "deepseek": "DeepSeek"
            }.get(model_key, model_key.upper())
            
            ai_models[model_key] = {
                "key": model_key,
                "name": model_display,
                "code": code_content
            }
            
    return [
        {
            "id": "assignment_1",
            "name": "The Autonomous Cargo Cart",
            "description": (
                "A robotic cargo cart must visit a sequence of grid coordinates (x, y) in a strict order. "
                "Moving between two grid points consumes battery equal to the Manhattan Distance between them. "
                "Landing exactly on a Charging Station refills the battery to 100 units. "
                "Write a C++ function to determine if the cart can safely finish its route without battery hitting <= 0."
            ),
            "ai_vault": ai_models
        }
    ]

@app.post("/api/compare")
def compare_submission(req: CompareRequest):
    """
    Compares the uploaded student submission against all pre-loaded AI model reference files
    stored in the assignment's AI vault.
    """
    if not os.path.exists(AI_VAULT_DIR):
        raise HTTPException(status_code=500, detail="Reference AI Vault not initialized on backend.")
        
    results = {}
    overall_flagged = False
    flagged_reasons = []
    
    # Process against each model in the vault
    for filename in os.listdir(AI_VAULT_DIR):
        if filename.endswith(".cpp"):
            model_key = filename.replace("reference_", "").replace(".cpp", "")
            filepath = os.path.join(AI_VAULT_DIR, filename)
            
            with open(filepath, "r") as f:
                ref_code = f.read()
                
            # Perform multi-tier comparison
            analysis = analyze_submission(
                student_code=req.student_code,
                reference_code=ref_code,
                force=req.force,
                sieve_threshold=req.sieve_threshold
            )
            
            results[model_key] = analysis
            
            if analysis["flag"] is not None:
                overall_flagged = True
                flagged_reasons.append(f"{model_key.upper()}: {analysis['flag']}")
                
    return {
        "assignment_id": req.assignment_id,
        "is_flagged": overall_flagged,
        "flagged_reasons": flagged_reasons,
        "results": results
    }
