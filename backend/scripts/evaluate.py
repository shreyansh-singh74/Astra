"""
Dual-Axis Evaluation Harness for Astra Forensic Engine.

Supports:
1. Leave-One-Problem-Out CV (GroupKFold on problem_id)
2. Leave-One-Model-Family-Out CV (GroupKFold on model_family)

Calculates ROC-AUC, Recall at target low FPR (e.g. 1%), Rule of 3 statistical FPR bounds,
and stratifies accuracy metrics across code line counts.
"""
from typing import Any, Dict, List, Tuple
import numpy as np


def calculate_metrics_at_target_fpr(
    y_true: np.ndarray,
    y_scores: np.ndarray,
    target_fpr: float = 0.01
) -> Dict[str, Any]:
    """
    Computes ROC-AUC, and Recall at a specific Target False Positive Rate (default 1.0%).
    Includes Rule of Three upper bound estimation for FPR based on human sample size.
    """
    from sklearn.metrics import roc_auc_score, roc_curve

    n_human = int(np.sum(y_true == 0))
    n_ai = int(np.sum(y_true == 1))

    if n_human == 0 or n_ai == 0:
        return {
            "auc": 0.0,
            "target_fpr": target_fpr,
            "threshold_at_target_fpr": 0.5,
            "recall_at_target_fpr": 0.0,
            "actual_fpr": 0.0,
            "rule_of_three_fpr_ub": 1.0,
            "n_human": n_human,
            "n_ai": n_ai,
        }

    auc = float(roc_auc_score(y_true, y_scores))
    fpr, tpr, thresholds = roc_curve(y_true, y_scores)

    # Find maximum threshold where FPR <= target_fpr
    valid_idx = np.where(fpr <= target_fpr)[0]
    # Rule of Three upper bound for zero false positives
    rule_of_three_ub = 3.0 / n_human if n_human > 0 else 1.0
    # Small-n guard: cannot claim target_fpr with fewer than 3/target human samples
    min_human_needed = int(np.ceil(3.0 / target_fpr))
    unreliable = n_human < min_human_needed
    if len(valid_idx) > 0 and not unreliable:
        idx = valid_idx[-1]
        threshold = float(thresholds[idx])
        recall = float(tpr[idx])
        actual_fpr = float(fpr[idx])
    else:
        threshold = float("inf")
        recall = 0.0
        actual_fpr = 0.0

    import math
    def _r(x):
        return round(x, 4) if math.isfinite(x) else "inf"
    return {
        "auc": round(auc, 4),
        "target_fpr": target_fpr,
        "threshold_at_target_fpr": _r(threshold),
        "recall_at_target_fpr": round(recall, 4),
        "actual_fpr": round(actual_fpr, 4),
        "rule_of_three_fpr_ub": round(rule_of_three_ub, 4),
        "n_human": n_human,
        "n_ai": n_ai,
        "min_human_needed": min_human_needed,
        "unreliable_small_n": unreliable,
        "warning": (
            f"Need ≥{min_human_needed} human samples to claim FPR≤{target_fpr}; "
            f"have {n_human}. Smoke test only — do not report."
            if unreliable else None
        ),
    }


def evaluate_predictions_stratified(
    y_true: np.ndarray,
    y_scores: np.ndarray,
    line_counts: np.ndarray,
    target_fpr: float = 0.01
) -> Dict[str, Any]:
    """
    Evaluates prediction metrics stratified by code length:
    - Short (< 20 lines)
    - Medium (20 - 50 lines)
    - Long (> 50 lines)
    """
    overall = calculate_metrics_at_target_fpr(y_true, y_scores, target_fpr=target_fpr)

    strata = {
        "short_<20_lines": line_counts < 20,
        "medium_20-50_lines": (line_counts >= 20) & (line_counts <= 50),
        "long_>50_lines": line_counts > 50,
    }

    stratified_results = {}
    for name, mask in strata.items():
        if np.sum(mask) > 0 and len(np.unique(y_true[mask])) > 1:
            stratified_results[name] = calculate_metrics_at_target_fpr(
                y_true[mask], y_scores[mask], target_fpr=target_fpr
            )
        else:
            stratified_results[name] = {
                "sample_count": int(np.sum(mask)),
                "status": "Insufficient samples or single class in stratum"
            }

    return {
        "overall": overall,
        "stratified_by_lines": stratified_results,
    }
