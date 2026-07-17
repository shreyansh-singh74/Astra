import hashlib
from typing import List, Set, Tuple
from tree_sitter import Language, Parser
import tree_sitter_cpp as ts_cpp

# Initialize C++ parser
CPP_LANGUAGE = Language(ts_cpp.language())
parser = Parser(CPP_LANGUAGE)

def get_clean_tokens(node, code_bytes: bytes) -> List[str]:
    """
    Recursively traverse the AST and extract all leaf nodes (tokens),
    skipping any nodes that represent comments.
    """
    # Skip comment nodes
    if node.type in ("comment", "line_comment", "block_comment"):
        return []
    
    # If it is a leaf node, extract text
    if node.child_count == 0:
        token_text = code_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="ignore")
        if token_text.strip():
            return [token_text]
        return []
    
    # Recursively traverse children
    tokens = []
    for child in node.children:
        tokens.extend(get_clean_tokens(child, code_bytes))
    return tokens

def scrub_code(code: str) -> str:
    """
    Parses C++ code, discards comments, and returns the tokens concatenated
    without layout whitespace.
    """
    code_bytes = code.encode("utf-8")
    tree = parser.parse(code_bytes)
    tokens = get_clean_tokens(tree.root_node, code_bytes)
    return "".join(tokens)

def get_kgrams(text: str, k: int) -> List[str]:
    """
    Extracts K-grams of length k from the normalized text.
    """
    if len(text) < k:
        return [text]
    return [text[i:i+k] for i in range(len(text) - k + 1)]

def hash_kgrams(kgrams: List[str]) -> List[int]:
    """
    Computes standard MD5 hashes for each K-gram, converting the hex output to integer.
    """
    hashes = []
    for kgram in kgrams:
        md5_hash = hashlib.md5(kgram.encode("utf-8")).hexdigest()
        hashes.append(int(md5_hash, 16))
    return hashes

def winnow(hashes: List[int], w: int) -> Set[Tuple[int, int]]:
    """
    Applies the winnowing algorithm to select minimum hashes in a sliding window
    of size w. Ties are broken by choosing the rightmost minimum.
    Returns a set of (hash, position) tuples.
    """
    fingerprints = set()
    n = len(hashes)
    if n == 0:
        return fingerprints
    
    if n < w:
        min_val = min(hashes)
        # Find rightmost occurrence
        min_pos = n - 1 - hashes[::-1].index(min_val)
        fingerprints.add((min_val, min_pos))
        return fingerprints
    
    for i in range(n - w + 1):
        window = hashes[i:i+w]
        min_val = min(window)
        # Find rightmost occurrence of min_val in the window
        min_pos = i + w - 1 - window[::-1].index(min_val)
        fingerprints.add((min_val, min_pos))
        
    return fingerprints

def get_fingerprints(code: str, k: int = 20, w: int = 10) -> Set[Tuple[int, int]]:
    """
    High-level API to get winnowing fingerprints for a C++ source code string.
    """
    scrubbed = scrub_code(code)
    kgrams = get_kgrams(scrubbed, k)
    hashes = hash_kgrams(kgrams)
    return winnow(hashes, w)

def calculate_similarity(fingerprints1: Set[Tuple[int, int]], fingerprints2: Set[Tuple[int, int]]) -> float:
    """
    Calculates the similarity (overlap percentage) between two sets of fingerprints.
    """
    if not fingerprints1 or not fingerprints2:
        return 0.0
    
    hash_vals1 = {h for h, _ in fingerprints1}
    hash_vals2 = {h for h, _ in fingerprints2}
    
    intersection = hash_vals1.intersection(hash_vals2)
    # We define similarity relative to the smaller of the two profiles,
    # or the average, or union. The original Jaccard similarity is:
    # Jaccard = |A intersect B| / |A union B|
    # However, to check for code inclusion (e.g. copying a snippet), 
    # overlap = |A intersect B| / min(|A|, |B|) or |A intersect B| / |A| is used.
    # Let's use Jaccard similarity, but let's also provide absolute overlap.
    # We will use Jaccard:
    union = hash_vals1.union(hash_vals2)
    return len(intersection) / len(union)
