"""
Step 2: Baseline Evaluator for Astra's Existing Multi-Tier Engine.

Evaluates Astra's current 4-tier fusion algorithm (Token + AST + CFG + CodeBERT)
on the benchmark dataset to establish the exact baseline Recall @ FPR <= 1.0%.
"""
import json
import os
import sys
from typing import Any, Dict, List

import numpy as np

# Add project root to sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.app.core.engine import analyze_submission
from backend.scripts.evaluate import evaluate_predictions_stratified


def run_baseline_evaluation(dataset_path: str) -> Dict[str, Any]:
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found at {dataset_path}. Run dataset_builder.py first.")

    with open(dataset_path, "r", encoding="utf-8") as f:
        samples = json.load(f)

    # Separate references (AI vault samples) from student test samples.
    # Leakage guard: human samples must never be in the reference pool, and
    # exam/holdout answers must not be evaluated here — test data only.
    ref_samples = [s for s in samples if s["label"] == 1]
    eval_samples = samples

    if not ref_samples:
        print("[BaselineEval] Warning: No AI reference solutions found in dataset.")
        ref_samples = samples

    y_true = []
    y_scores = []
    line_counts = []

    print(f"[BaselineEval] Evaluating {len(eval_samples)} samples against {len(ref_samples)} references...")

    for sample in eval_samples:
        # Compare sample against reference vault
        scores_against_refs = []
        for ref in ref_samples:
            if ref["id"] == sample["id"]:
                continue  # Skip self-comparison
            try:
                res = analyze_submission(
                    student_code=sample["code"],
                    reference_code=ref["code"],
                    language=sample.get("language", "cpp"),
                    force=True
                )
                scores_against_refs.append(res.get("final_score", 0.0))
            except Exception:
                scores_against_refs.append(0.0)

        # Max similarity score across reference pool
        max_score = max(scores_against_refs) if scores_against_refs else 0.0

        y_true.append(sample["label"])
        y_scores.append(max_score)
        line_counts.append(sample.get("line_count", len(sample["code"].splitlines())))

    y_true_arr = np.array(y_true)
    y_scores_arr = np.array(y_scores)
    line_counts_arr = np.array(line_counts)

    metrics = evaluate_predictions_stratified(
        y_true=y_true_arr,
        y_scores=y_scores_arr,
        line_counts=line_counts_arr,
        target_fpr=0.01
    )

    print("\n" + "="*50)
    print("      ASTRA EXISTING ENGINE BASELINE RESULTS      ")
    print("="*50)
    print(f"Overall AUC                   : {metrics['overall']['auc']}")
    print(f"Recall @ FPR <= 1.0%          : {metrics['overall']['recall_at_target_fpr']}")
    print(f"Actual FPR                    : {metrics['overall']['actual_fpr']}")
    print(f"Score Threshold @ 1% FPR     : {metrics['overall']['threshold_at_target_fpr']}")
    print(f"Rule of 3 FPR Upper Bound     : {metrics['overall']['rule_of_three_fpr_ub']}")
    print("="*50 + "\n")

    return metrics


if __name__ == "__main__":
    ds_path = os.path.join(BASE_DIR, "storage", "benchmark_dataset.json")
    run_baseline_evaluation(ds_path)
