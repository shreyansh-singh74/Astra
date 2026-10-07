import networkx as nx
from typing import Dict, Any, Optional
from backend.app.core.winnowing import get_fingerprints, calculate_similarity, scrub_code
from backend.app.core.ast_normalizer import normalize_ast
from backend.app.core.codebert import get_embedding, calculate_cosine_similarity
from backend.app.core.cfg_compiler import CFGCompiler, compare_cfgs

DEFAULT_WEIGHTS = {"token": 0.20, "ast": 0.20, "cfg": 0.20, "semantic": 0.40}


def analyze_submission(
    student_code: str,
    reference_code: str,
    force: bool = False,
    sieve_threshold: float = 0.10,
    semantic_score: Optional[float] = None,
    language: str = "cpp",
    weights: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Runs the multi-tier comparison between the student submission and a reference file.
    Follows the dual-sieve pipeline:
    1. Quick token winnowing check. If similarity is below sieve_threshold (default 10%),
       it is considered safe and deep analysis is skipped (unless force is True).
    2. Deep AST normalization, CFG compilation, and CodeBERT embeddings.
    3. Multi-tier score fusion and diagnostics.

    semantic_score: precomputed, corpus-centered CodeBERT similarity (see
    codebert.compute_corpus_semantics). Passing it is REQUIRED for a fair
    comparison — raw CodeBERT cosine saturates near 1.0 for any code solving
    the same assignment, which would falsely flag genuinely independent
    answers. If omitted, the legacy raw-cosine path is used as a fallback.

    weights: optional override of the fusion weights, e.g. configurable from
    the UI. Defaults to 20/20/20/40.
    """
    w = dict(DEFAULT_WEIGHTS)
    if weights:
        w.update({k: float(v) for k, v in weights.items() if k in w})

    # Stage 1: Token Winnowing
    student_fg = get_fingerprints(student_code, language=language)
    ref_fg = get_fingerprints(reference_code, language=language)
    token_score = calculate_similarity(student_fg, ref_fg)

    status = "ANALYZED"
    if token_score < sieve_threshold and not force:
        return {
            "status": "SKIPPED",
            "token_score": token_score,
            "ast_score": 0.0,
            "cfg_score": 0.0,
            "semantic_score": 0.0,
            "final_score": 0.0,
            "diagnostics": "Skipped due to low token overlap (Safe).",
            "flag": None,
            "student_ast_code": "",
            "ref_ast_code": "",
            "student_cfg": {"nodes": [], "edges": []},
            "ref_cfg": {"nodes": [], "edges": []}
        }

    # Stage 2: AST Normalization
    student_ast_code, student_var_map = normalize_ast(student_code, language)
    ref_ast_code, ref_var_map = normalize_ast(reference_code, language)

    # Calculate AST similarity using winnowing on the normalized AST code
    student_ast_fg = get_fingerprints(student_ast_code, language=language)
    ref_ast_fg = get_fingerprints(ref_ast_code, language=language)
    ast_score = calculate_similarity(student_ast_fg, ref_ast_fg)

    # Stage 3: CFG Compiler
    try:
        compiler1 = CFGCompiler(student_code, language)
        g1, meta1 = compiler1.compile()

        compiler2 = CFGCompiler(reference_code, language)
        g2, meta2 = compiler2.compile()

        cfg_score = compare_cfgs(g1, g2)

        # Serialize graph for frontend visualization
        student_cfg_serialized = {
            "nodes": [meta1[n] for n in g1.nodes],
            "edges": [{"source": u, "target": v} for u, v in g1.edges]
        }
        ref_cfg_serialized = {
            "nodes": [meta2[n] for n in g2.nodes],
            "edges": [{"source": u, "target": v} for u, v in g2.edges]
        }
    except Exception:
        cfg_score = 0.0
        student_cfg_serialized = {"nodes": [], "edges": []}
        ref_cfg_serialized = {"nodes": [], "edges": []}

    # Stage 4: CodeBERT Semantic Vector
    if semantic_score is None:
        # Legacy single-shot fallback: raw cosine of the pooled embeddings.
        # NOTE: this saturates near 1.0 for ANY code solving the same task
        # (shared boilerplate dominates the pooled vector), so it cannot
        # distinguish independent work from plagiarism. Prefer passing a
        # corpus-centered semantic_score (see codebert.compute_corpus_semantics).
        try:
            # Scrub comments and spacing for embedding to focus purely on code semantics
            scrubbed_student = scrub_code(student_code, language)
            scrubbed_ref = scrub_code(reference_code, language)

            student_emb = get_embedding(scrubbed_student)
            ref_emb = get_embedding(scrubbed_ref)

            semantic_score = calculate_cosine_similarity(student_emb, ref_emb)
        except Exception:
            semantic_score = 0.0

    # Multi-Tier Score Fusion
    final_score = (
        w["token"] * token_score
        + w["ast"] * ast_score
        + w["cfg"] * cfg_score
        + w["semantic"] * semantic_score
    )
    
    # Obfuscation Analytics Processor
    flag = None
    diagnostics = "No anomaly detected."

    # Semantic thresholds below are calibrated for CORPUS-CENTERED CodeBERT
    # similarities (see codebert.compute_corpus_semantics), which are far more
    # discriminative than raw cosine:
    #   * AI-renamed / de-clustered copies of a reference:     0.45 - 0.85
    #   * Genuinely independent answers (e.g. the segment-based
    #     storage/submissions/student_independent_solution.cpp):  < 0.25
    #
    # Rule 1: GPT-4o mimicry (Variable Renaming & Custom Extraction)
    # Typically: low/mid token overlap, high AST structural mapping, high semantic similarity
    if token_score < 0.35 and ast_score >= 0.80 and semantic_score >= 0.60:
        flag = "AI-Assisted Paraphrasing: GPT-4o / Gemini 1.5 Pattern"
        diagnostics = "Flagged: Variable renaming, whitespace alterations, and custom extraction patterns detected while matching standard tree structures."
        
    # Rule 2: Claude 3.5 mimicry (Advanced Structural Data De-clustering)
    # Typically: very low token overlap, low AST mapping (due to rewrite to basic arrays/structs), but high semantic similarity
    elif token_score < 0.25 and ast_score < 0.60 and semantic_score >= 0.40:
        flag = "AI-Assisted Paraphrasing: Claude 3.5 Pattern"
        diagnostics = "Flagged: Advanced structural data de-clustering. High semantic correlation matching custom struct/array de-composition logic."
        
    # Rule 3: Flat Control Flow Duplication (Gemini 1.5 / General)
    elif token_score < 0.40 and ast_score >= 0.70 and semantic_score >= 0.55:
        flag = "AI-Assisted Paraphrasing: Flat Logic Duplication"
        diagnostics = "Flagged: Flat control flow structure duplicated. Standard loop and conditional pathways match references exactly."
        
    # General Plagiarism / Copying flag
    elif final_score >= 0.70:
        flag = "High Plagiarism Risk"
        diagnostics = "Flagged: Highly identical code structure and semantics."
        
    return {
        "status": status,
        "token_score": token_score,
        "ast_score": ast_score,
        "cfg_score": cfg_score,
        "semantic_score": semantic_score,
        "final_score": final_score,
        "diagnostics": diagnostics,
        "flag": flag,
        "student_ast_code": student_ast_code,
        "ref_ast_code": ref_ast_code,
        "student_cfg": student_cfg_serialized,
        "ref_cfg": ref_cfg_serialized
    }
