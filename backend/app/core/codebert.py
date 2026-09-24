import torch
from transformers import AutoTokenizer, AutoModel
import numpy as np
from typing import List

# Cache model and tokenizer globally to avoid reloading them on each request
_tokenizer = None
_model = None

def get_codebert_model():
    global _tokenizer, _model
    if _model is None or _tokenizer is None:
        model_name = "microsoft/codebert-base"
        _tokenizer = AutoTokenizer.from_pretrained(model_name)
        _model = AutoModel.from_pretrained(model_name)
        _model.eval() # Set model to evaluation mode
    return _tokenizer, _model

def get_embedding(code: str) -> np.ndarray:
    """
    Generates a 768-dimensional semantic embedding for a code snippet
    using the microsoft/codebert-base model.
    """
    tokenizer, model = get_codebert_model()
    
    # Tokenize input code with truncation to 512 tokens
    inputs = tokenizer(code, return_tensors="pt", truncation=True, max_length=512)
    
    with torch.no_grad():
        outputs = model(**inputs)
        
    # Apply mean-pooling over the sequence length dimension (dim=1)
    # output.last_hidden_state shape: [batch_size, sequence_length, hidden_size]
    # mean shape: [hidden_size]
    embeddings = outputs.last_hidden_state.mean(dim=1).squeeze().numpy()
    return embeddings

def calculate_cosine_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
    """
    Computes the Cosine Similarity between two embedding vectors.
    """
    norm1 = np.linalg.norm(emb1)
    norm2 = np.linalg.norm(emb2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(np.dot(emb1, emb2) / (norm1 * norm2))

def compute_corpus_semantics(student_code: str, reference_codes: List[str]) -> List[float]:
    """
    Mean-centered semantic similarity of the student code against every reference.

    Raw CodeBERT cosine similarity saturates near 1.0 for ANY C++ code that
    solves the same problem: the pooled embedding is dominated by shared
    boilerplate tokens (int, vector, abs, braces, ...), so it cannot tell an
    independent solution apart from a plagiarized one.

    The fix: subtract the corpus mean embedding (student + all references)
    from every vector before computing cosine. This removes the shared
    "solves this assignment" component and leaves only the distinctive parts,
    which makes the score discriminative:

      * AI-renamed / de-clustered copies of a reference keep a HIGH score
        (e.g. 0.45 - 0.85 against their source reference).
      * A genuinely different answer scores near 0 or negative against every
        reference (e.g. the segment-based solution in
        storage/submissions/student_independent_solution.cpp), which is
        exactly the "good different answer" case that must NOT be flagged.

    Scores are clamped to [0, 1] since a negative semantic similarity is
    meaningless downstream.
    """
    student_emb = get_embedding(student_code)
    ref_embs = [get_embedding(code) for code in reference_codes]

    corpus = np.vstack([student_emb] + ref_embs)
    corpus_mean = corpus.mean(axis=0)

    centered_student = student_emb - corpus_mean
    centered_refs = [emb - corpus_mean for emb in ref_embs]

    return [
        max(0.0, calculate_cosine_similarity(centered_student, centered_ref))
        for centered_ref in centered_refs
    ]
