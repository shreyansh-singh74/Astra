"""Evaluation harness exposed to the frontend.

Wraps backend/scripts/dataset_builder.py, eval_astra_baseline.py and
train_eval_stylometrics.py so the Scan UI flow (your screenshot) can be
explained end-to-end: where the numbers come from, and why small-n
results are smoke tests only.
"""
import os

from fastapi import APIRouter, HTTPException

from backend.scripts import dataset_builder as builder
from backend.scripts import eval_astra_baseline as baseline
from backend.scripts import train_eval_stylometrics as stylo

router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
DATASET_PATH = os.path.join(BASE_DIR, "storage", "benchmark_dataset.json")


def _dataset_counts():
    if not os.path.exists(DATASET_PATH):
        return {"exists": False, "total": 0, "human": 0, "ai": 0, "path": DATASET_PATH}
    import json

    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        samples = json.load(f)
    human = sum(1 for s in samples if s.get("label") == 0)
    return {"exists": True, "total": len(samples), "human": human,
            "ai": len(samples) - human, "path": DATASET_PATH}


@router.get("/status")
def status():
    return _dataset_counts()


@router.post("/dataset/build")
def build_dataset():
    human_path = os.path.join(BASE_DIR, "storage", "submissions")
    ai_path = os.path.join(BASE_DIR, "storage", "assignments", "assignment_1", "ai_vault")
    try:
        ds = builder.load_dataset_from_directories(human_dir=human_path, ai_dir=ai_path)
        builder.save_dataset(ds, DATASET_PATH)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Dataset build failed: {exc}")
    return _dataset_counts()


@router.post("/baseline")
def run_baseline():
    try:
        metrics = baseline.run_baseline_evaluation(DATASET_PATH)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Baseline eval failed: {exc}")
    return {"dataset": _dataset_counts(), "metrics": metrics}


@router.post("/stylometrics")
def run_stylometrics():
    try:
        metrics = stylo.run_stylometrics_evaluation(DATASET_PATH)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Stylometrics eval failed: {exc}")
    return {"dataset": _dataset_counts(), "metrics": metrics}
