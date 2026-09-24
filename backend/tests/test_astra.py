import pytest
import networkx as nx
from backend.app.core.winnowing import scrub_code, get_fingerprints, calculate_similarity
from backend.app.core.ast_normalizer import normalize_ast
from backend.app.core.cfg_compiler import CFGCompiler, compare_cfgs

def test_lexical_scrubber():
    # C++ code with comments
    code_with_comments = """
    // This is a line comment
    int main() {
        /* This is a
           block comment */
        return 0;
    }
    """
    scrubbed = scrub_code(code_with_comments)
    assert "comment" not in scrubbed
    assert "main" in scrubbed
    # Layout whitespaces should be stripped
    assert " " not in scrubbed
    assert "\n" not in scrubbed

def test_winnowing_similarity():
    code1 = "int canCompleteRoute(std::vector<std::pair<int, int>> route, std::vector<std::pair<int, int>> chargers) { return true; }"
    code2 = "int canCompleteRoute(std::vector<std::pair<int, int>> route, std::vector<std::pair<int, int>> chargers) { return true; } // minor change"
    
    fg1 = get_fingerprints(code1, k=10, w=5)
    fg2 = get_fingerprints(code2, k=10, w=5)
    
    similarity = calculate_similarity(fg1, fg2)
    assert similarity > 0.85 # High overlap expected

def test_ast_normalizer():
    original_code = """
    int calculateManhattan(std::pair<int, int> p1, std::pair<int, int> p2) {
        return std::abs(p1.first - p2.first) + std::abs(p1.second - p2.second);
    }
    """
    normalized, mapping = normalize_ast(original_code)
    
    # Custom function name should be func_0
    assert "func_0" in normalized
    assert "calculateManhattan" not in normalized
    # Variable names p1 and p2 should be var_0 and var_1
    assert "var_0" in normalized
    assert "var_1" in normalized
    assert "p1" not in normalized
    # Standard items like std::pair, std::abs should be kept
    assert "std" in normalized
    assert "pair" in normalized
    assert "abs" in normalized

def test_cfg_compiler():
    code = """
    bool checkRouteSafety(std::vector<std::pair<int, int>>& r, std::vector<std::pair<int, int>>& c) {
        int b = 100;
        for(int idx = 0; idx < (int)r.size() - 1; idx++) {
            if (b <= 0) return false;
            b = 100;
        }
        return true;
    }
    """
    compiler = CFGCompiler(code)
    g, meta = compiler.compile()
    
    # Check that Entry, Exit, Loop, and If nodes are found
    node_types = [meta[nid]["type"] for nid in g.nodes]
    assert "entry" in node_types
    assert "exit" in node_types
    assert "loop" in node_types
    assert "if" in node_types
    assert "return" in node_types
    
    # Check edges exist
    assert g.number_of_nodes() > 0
    assert g.number_of_edges() > 0
