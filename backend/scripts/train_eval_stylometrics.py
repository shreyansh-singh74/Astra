"""
Step 3: Stylometric Classifier Training & Dual-Axis Evaluation.

Trains a Platt-scaled Classifier (Calibrated Logistic Regression / Gradient Boosting)
on clean stylometric features extracted from the benchmark dataset.

Performs cross-validation with Stratified splits to guarantee both human (0)
and AI (1) classes exist in every training fold.
"""
import json
import os
import sys
from typing import Any, Dict, List

import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler

# Add project root to sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.app.core.stylometrics import extract_stylometric_features
from backend.scripts.evaluate import evaluate_predictions_stratified


def run_stylometrics_evaluation(dataset_path: str) -> Dict[str, Any]:
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found at {dataset_path}. Run dataset_builder.py first.")

    with open(dataset_path, "r", encoding="utf-8") as f:
        samples = json.load(f)

    if len(samples) < 4:
        raise ValueError(f"Dataset has only {len(samples)} samples. Need at least 4 for cross-validation.")

    # 1. Feature Extraction
    X_raw = []
    y_raw = []
    line_counts = []

    feature_names = [
        "line_count", "comment_density", "indent_std",
        "id_len_mean", "id_len_std", "max_nesting_depth",
        "defensive_ratio", "avg_line_length", "blank_line_ratio"
    ]

    for sample in samples:
        feat_dict = extract_stylometric_features(sample["code"], sample.get("language", "cpp"))
        feat_vector = [feat_dict[k] for k in feature_names]

        X_raw.append(feat_vector)
        y_raw.append(sample["label"])
        line_counts.append(sample.get("line_count", int(feat_dict["line_count"])))

    X = np.array(X_raw)
    y = np.array(y_raw)
    line_counts_arr = np.array(line_counts)

    classes, counts = np.unique(y, return_counts=True)
    if len(classes) < 2:
        raise ValueError(f"Dataset must contain both human (0) and AI (1) samples. Found classes: {classes}")

    min_class_count = int(min(counts))
    n_outer_splits = max(2, min(min_class_count, 5))

    # 2. Stratified Cross-Validation with Platt Scaling Calibration
    scores_cv = np.zeros(len(y))
    skf = StratifiedKFold(n_splits=n_outer_splits, shuffle=True, random_state=42)

    for train_idx, test_idx in skf.split(X, y):
        X_train, y_train = X[train_idx], y[train_idx]
        X_test = X[test_idx]

        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)

        base_clf = LogisticRegression(C=1.0, max_iter=1000)

        # Determine safe cv folds for inner calibration
        train_counts = np.bincount(y_train)
        min_train_count = int(np.min(train_counts)) if len(train_counts) > 1 else 0

        if min_train_count >= 2:
            inner_cv = max(2, min(min_train_count, 3))
            calibrated = CalibratedClassifierCV(estimator=base_clf, method="sigmoid", cv=inner_cv)
            calibrated.fit(X_train_scaled, y_train)
            probs = calibrated.predict_proba(X_test_scaled)[:, 1]
        else:
            base_clf.fit(X_train_scaled, y_train)
            probs = base_clf.predict_proba(X_test_scaled)[:, 1]

        scores_cv[test_idx] = probs

    metrics_stylometrics = evaluate_predictions_stratified(
        y_true=y,
        y_scores=scores_cv,
        line_counts=line_counts_arr,
        target_fpr=0.01
    )

    print("\n" + "="*50)
    print("   STEP 3 STYLOMETRIC CLASSIFIER EVALUATION RESULTS   ")
    print("="*50)
    print(f"Overall Stratified AUC        : {metrics_stylometrics['overall']['auc']}")
    print(f"Recall @ FPR <= 1.0%          : {metrics_stylometrics['overall']['recall_at_target_fpr']}")
    print(f"Actual FPR                    : {metrics_stylometrics['overall']['actual_fpr']}")
    print(f"Calibrated Threshold @ 1% FPR: {metrics_stylometrics['overall']['threshold_at_target_fpr']}")
    print(f"Rule of 3 FPR Upper Bound     : {metrics_stylometrics['overall']['rule_of_three_fpr_ub']}")
    print("="*50 + "\n")

    return metrics_stylometrics


if __name__ == "__main__":
    ds_path = os.path.join(BASE_DIR, "storage", "benchmark_dataset.json")
    run_stylometrics_evaluation(ds_path)
