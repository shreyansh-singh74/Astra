import os
import sys

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.core.engine import analyze_submission

SUBMISSIONS_DIR = "storage/submissions"
AI_VAULT_DIR = "storage/assignments/assignment_1/ai_vault"

def test_submission(student_file: str, ref_file: str):
    student_path = os.path.join(SUBMISSIONS_DIR, student_file)
    ref_path = os.path.join(AI_VAULT_DIR, ref_file)
    
    with open(student_path, "r") as f:
        student_code = f.read()
    with open(ref_path, "r") as f:
        ref_code = f.read()
        
    print(f"\n--- Comparing {student_file} against {ref_file} ---")
    
    # We set force=True to bypass dual-sieve check for comprehensive report
    result = analyze_submission(student_code, ref_code, force=True)
    
    print(f"Token Winnowing Similarity : {result['token_score']:.2%}")
    print(f"AST Normalized Similarity  : {result['ast_score']:.2%}")
    print(f"CFG Structural Similarity  : {result['cfg_score']:.2%}")
    print(f"CodeBERT Semantic Similarity: {result['semantic_score']:.2%}")
    print(f"Fused Similarity Score     : {result['final_score']:.2%}")
    print(f"Diagnostics: {result['diagnostics']}")
    print(f"Flag       : {result['flag']}")
    
def main():
    print("CodeSleuth AI Backend Offline Testing Pipeline")
    
    # Test 1: GPT-4o renamed submission against GPT-4o reference
    test_submission("student_gpt4o_renamed.cpp", "reference_gpt4o.cpp")
    
    # Test 2: Claude 3.5 arrays submission against Claude 3.5 reference
    test_submission("student_claude35_arrays.cpp", "reference_claude35.cpp")
    
    # Test 3: Gemini 1.5 loops submission against Gemini 1.5 reference
    test_submission("student_gemini15_loops.cpp", "reference_gemini15.cpp")

if __name__ == "__main__":
    main()
