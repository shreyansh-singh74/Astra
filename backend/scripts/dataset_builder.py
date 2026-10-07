"""
Step 1 Dataset Builder for Astra Forensic Engine.

Assembles ground-truth human submissions and AI-generated submissions into a
standardized dataset format for evaluation. Smartly parses filenames to prevent
mislabeling AI test files (e.g. student_claude35_arrays.cpp) as human code.
"""
import json
import os
from typing import Any, Dict, List


def load_dataset_from_directories(
    human_dir: str,
    ai_dir: str,
    problem_id: str = "problem_1",
    language: str = "cpp"
) -> List[Dict[str, Any]]:
    dataset = []

    def classify_file(fname: str, default_label: int) -> tuple[int, str]:
        lower = fname.lower()
        if "gpt" in lower:
            return 1, "openai"
        if "claude" in lower:
            return 1, "anthropic"
        if "gemini" in lower:
            return 1, "google"
        if "deepseek" in lower:
            return 1, "deepseek"
        if "human" in lower or "independent" in lower:
            return 0, "human"
        return default_label, ("human" if default_label == 0 else "llm_unknown")

    # 1. Ingest files from submissions folder
    if os.path.exists(human_dir):
        for fname in sorted(os.listdir(human_dir)):
            if fname.startswith(".") or not fname.endswith((".cpp", ".py", ".java")):
                continue
            fpath = os.path.join(human_dir, fname)
            if os.path.isfile(fpath):
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    code = f.read()
                line_count = len([line for line in code.splitlines() if line.strip()])
                label, model_family = classify_file(fname, default_label=0)

                dataset.append({
                    "id": f"{'ai' if label == 1 else 'human'}_{fname}",
                    "filename": fname,
                    "code": code,
                    "label": label,
                    "label_name": "ai" if label == 1 else "human",
                    "problem_id": problem_id,
                    "model_family": model_family,
                    "language": language,
                    "line_count": line_count,
                })

    # 2. Ingest files from AI Vault
    if os.path.exists(ai_dir):
        for fname in sorted(os.listdir(ai_dir)):
            if fname.startswith(".") or not fname.endswith((".cpp", ".py", ".java")):
                continue
            fpath = os.path.join(ai_dir, fname)
            if os.path.isfile(fpath):
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    code = f.read()
                line_count = len([line for line in code.splitlines() if line.strip()])
                label, model_family = classify_file(fname, default_label=1)

                dataset.append({
                    "id": f"ai_vault_{fname}",
                    "filename": fname,
                    "code": code,
                    "label": 1,
                    "label_name": "ai",
                    "problem_id": problem_id,
                    "model_family": model_family,
                    "language": language,
                    "line_count": line_count,
                })

    return dataset


def save_dataset(dataset: List[Dict[str, Any]], output_path: str) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2)

    human_count = sum(1 for s in dataset if s["label"] == 0)
    ai_count = sum(1 for s in dataset if s["label"] == 1)
    print(f"[DatasetBuilder] Saved {len(dataset)} samples ({human_count} Human, {ai_count} AI) to {output_path}")


if __name__ == "__main__":
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    human_path = os.path.join(base_dir, "storage", "submissions")
    ai_path = os.path.join(base_dir, "storage", "assignments", "assignment_1", "ai_vault")
    out_path = os.path.join(base_dir, "storage", "benchmark_dataset.json")

    ds = load_dataset_from_directories(human_dir=human_path, ai_dir=ai_path)
    save_dataset(ds, out_path)
