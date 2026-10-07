"""
Student-to-student collusion analysis.

Precomputes each submission's tier artifacts once (fingerprints, normalized
AST, CFG, CodeBERT embedding), then scores every pair. Semantic scores are
corpus-centered across ALL submissions so that students who independently
solved the assignment aren't flagged for sharing boilerplate intent, while
copied logic keeps a high centered score. Flagged pairs are merged into
collusion clusters with union-find.
"""
from typing import Any, Callable, Dict, List, Optional

from backend.app.core.codebert import calculate_cosine_similarity, get_embedding
from backend.app.core.engine import DEFAULT_WEIGHTS
from backend.app.core.winnowing import calculate_similarity, get_fingerprints, scrub_code
from backend.app.core.ast_normalizer import normalize_ast
from backend.app.core.cfg_compiler import CFGCompiler, compare_cfgs


class _UnionFind:
    def __init__(self, n: int):
        self.parent = list(range(n))

    def find(self, i: int) -> int:
        while self.parent[i] != i:
            self.parent[i] = self.parent[self.parent[i]]
            i = self.parent[i]
        return i

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


def _precompute(code: str, language: str) -> Dict[str, Any]:
    ast_code, _ = normalize_ast(code, language)
    artifact: Dict[str, Any] = {
        "fingerprints": get_fingerprints(code, language=language),
        "ast_fingerprints": get_fingerprints(ast_code, language=language),
        "cfg_graph": None,
    }
    try:
        graph, _meta = CFGCompiler(code, language).compile()
        artifact["cfg_graph"] = graph
    except Exception:
        artifact["cfg_graph"] = None

    try:
        artifact["embedding"] = get_embedding(scrub_code(code, language))
    except Exception:
        artifact["embedding"] = None
    return artifact


def _pair_diagnostics(token: float, ast: float, cfg: float, semantic: float) -> str:
    if token >= 0.60:
        return "Near-identical token fingerprints — likely direct copy with light edits."
    if semantic >= 0.55 and (ast >= 0.60 or cfg >= 0.60):
        return "High semantic match with aligned structure — strong collusion evidence."
    if cfg >= 0.90:
        return "Isomorphic control flow — logic copied despite surface renaming."
    if semantic >= 0.40:
        return "Elevated semantic correlation — review manually."
    return "Moderate overlap — likely benign."


def _pair_score(a: Dict[str, Any], b: Dict[str, Any], semantic_score: float,
                weights: Dict[str, float]) -> Dict[str, Any]:
    token_score = calculate_similarity(a["fingerprints"], b["fingerprints"])
    ast_score = calculate_similarity(a["ast_fingerprints"], b["ast_fingerprints"])

    cfg_score = 0.0
    if a["cfg_graph"] is not None and b["cfg_graph"] is not None:
        try:
            cfg_score = compare_cfgs(a["cfg_graph"], b["cfg_graph"])
        except Exception:
            cfg_score = 0.0

    final_score = (
        weights["token"] * token_score
        + weights["ast"] * ast_score
        + weights["cfg"] * cfg_score
        + weights["semantic"] * semantic_score
    )
    return {
        "token_score": token_score,
        "ast_score": ast_score,
        "cfg_score": cfg_score,
        "semantic_score": semantic_score,
        "final_score": final_score,
        "diagnostics": _pair_diagnostics(token_score, ast_score, cfg_score, semantic_score),
    }


def run_collusion_analysis(
    submissions: List[Dict[str, Any]],
    threshold: float = 0.70,
    weights: Optional[Dict[str, float]] = None,
    progress_cb: Optional[Callable[[float], None]] = None,
) -> Dict[str, Any]:
    """
    submissions: list of {id, student_name, filename, language, code}.
    Returns {students, pairs, matrix, clusters, threshold}.
    """
    w = dict(DEFAULT_WEIGHTS)
    if weights:
        w.update({k: float(v) for k, v in weights.items() if k in w})

    n = len(submissions)
    if n < 2:
        students = [
            {"id": s["id"], "student_name": s["student_name"], "filename": s["filename"],
             "language": s["language"]}
            for s in submissions
        ]
        return {"students": students, "pairs": [], "matrix": [], "clusters": [], "threshold": threshold}

    # 1. Precompute artifacts (progress 0 → 0.4)
    artifacts: List[Dict[str, Any]] = []
    for idx, sub in enumerate(submissions):
        artifacts.append(_precompute(sub["code"], sub.get("language") or "cpp"))
        if progress_cb:
            progress_cb(0.4 * (idx + 1) / n)

    # 2. Semantic scores for every pair (progress 0.4 → 0.6)
    # Corpus-centered cosine when >= 3 embeddings (removes shared boilerplate);
    # with exactly 2, centering makes the vectors antiparallel by construction,
    # so raw cosine is used instead.
    embeddings = [a["embedding"] for a in artifacts]
    semantic_matrix: List[List[Optional[float]]] = [[None] * n for _ in range(n)]
    usable = [e for e in embeddings if e is not None]
    if len(usable) >= 2:
        if len(usable) >= 3:
            import numpy as np
            corpus_mean = np.vstack(usable).mean(axis=0)
            centered = [
                (emb - corpus_mean) if emb is not None else None for emb in embeddings
            ]
        else:
            centered = embeddings
        for i in range(n):
            for j in range(i + 1, n):
                if centered[i] is None or centered[j] is None:
                    semantic_matrix[i][j] = semantic_matrix[j][i] = 0.0
                else:
                    semantic_matrix[i][j] = semantic_matrix[j][i] = max(
                        0.0, calculate_cosine_similarity(centered[i], centered[j])
                    )

    # 3. Pairwise scores (progress 0.6 → 0.95)
    pairs: List[Dict[str, Any]] = []
    matrix = [[0.0] * n for _ in range(n)]
    uf = _UnionFind(n)

    total_pairs = n * (n - 1) // 2
    done = 0
    for i in range(n):
        for j in range(i + 1, n):
            sem = semantic_matrix[i][j] if semantic_matrix[i][j] is not None else 0.0
            scores = _pair_score(artifacts[i], artifacts[j], float(sem), w)
            matrix[i][j] = matrix[j][i] = round(scores["final_score"], 4)
            if scores["final_score"] >= threshold:
                uf.union(i, j)
                pairs.append({
                    "a_id": submissions[i]["id"],
                    "b_id": submissions[j]["id"],
                    "a_name": submissions[i]["student_name"] or submissions[i]["filename"],
                    "b_name": submissions[j]["student_name"] or submissions[j]["filename"],
                    **{k: round(v, 4) for k, v in scores.items() if isinstance(v, float)},
                })
            done += 1
            if progress_cb and total_pairs:
                progress_cb(0.6 + 0.35 * done / total_pairs)

    # 4. Cluster flagged students (union-find groups with >= 2 members)
    groups: Dict[int, List[int]] = {}
    for i in range(n):
        groups.setdefault(uf.find(i), []).append(i)

    clusters = []
    for members in groups.values():
        if len(members) < 2:
            continue
        member_scores = [max(
            (matrix[i][j] for j in members if j != i), default=0.0
        ) for i in members]
        clusters.append({
            "member_ids": [submissions[i]["id"] for i in members],
            "members": [
                submissions[i]["student_name"] or submissions[i]["filename"] for i in members
            ],
            "avg_internal_score": round(sum(member_scores) / len(member_scores), 4),
            "peak_internal_score": round(max(member_scores), 4),
        })
    clusters.sort(key=lambda c: -c["peak_internal_score"])

    if progress_cb:
        progress_cb(1.0)

    return {
        "students": [
            {"id": s["id"], "student_name": s["student_name"], "filename": s["filename"],
             "language": s["language"]}
            for s in submissions
        ],
        "pairs": sorted(pairs, key=lambda p: -p["final_score"]),
        "matrix": matrix,
        "clusters": clusters,
        "threshold": threshold,
    }
