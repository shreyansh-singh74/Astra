"""
Vault comparison orchestration.

The critical scoring fix lives here: semantic similarity is computed with
corpus-centered CodeBERT embeddings (student + all same-language references
centered on their mean), which is discriminative. The legacy raw-cosine path
saturates near 1.0 for ANY code solving the same assignment and would flag
genuinely independent work.
"""
from typing import Any, Dict, List, Optional

from backend.app.core.codebert import compute_corpus_semantics
from backend.app.core.engine import analyze_submission


def compare_against_vault(
    student_code: str,
    language: str,
    references: List[Dict[str, Any]],
    force: bool = False,
    sieve_threshold: float = 0.10,
    weights: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Compare one submission against every same-language vault reference.

    references: rows from db.list_references() — dicts with at least
    model_key, model_name, language, code.

    Returns the legacy /api/compare response shape:
    {is_flagged, flagged_reasons, results: {model_key: analysis}}
    """
    same_lang_refs = [r for r in references if (r.get("language") or "cpp") == language]
    results: Dict[str, Any] = {}
    overall_flagged = False
    flagged_reasons: List[str] = []

    if same_lang_refs:
        # One CodeBERT pass for the whole corpus (student + references),
        # producing fair, corpus-centered semantic scores per reference.
        try:
            semantic_scores = compute_corpus_semantics(
                student_code, [r["code"] for r in same_lang_refs]
            )
        except Exception:
            semantic_scores = [None] * len(same_lang_refs)
    else:
        semantic_scores = []

    for ref, semantic_score in zip(same_lang_refs, semantic_scores):
        analysis = analyze_submission(
            student_code=student_code,
            reference_code=ref["code"],
            force=force,
            sieve_threshold=sieve_threshold,
            semantic_score=semantic_score,
            language=language,
            weights=weights,
        )
        results[ref["model_key"]] = analysis

        if analysis["flag"] is not None:
            overall_flagged = True
            flagged_reasons.append(f"{ref['model_name']}: {analysis['flag']}")

    return {
        "is_flagged": overall_flagged,
        "flagged_reasons": flagged_reasons,
        "results": results,
    }
