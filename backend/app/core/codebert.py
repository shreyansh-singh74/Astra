import torch
from transformers import AutoTokenizer, AutoModel
import numpy as np

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
