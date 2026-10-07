import pytest

from backend.app.core.languages import LANGUAGES, detect_language, get_language, get_parser
from backend.app.core.winnowing import calculate_similarity, get_fingerprints, scrub_code
from backend.app.core.ast_normalizer import normalize_ast
from backend.app.core.cfg_compiler import CFGCompiler, compare_cfgs


def test_registry_covers_three_languages():
    assert set(LANGUAGES.keys()) == {"cpp", "python", "java"}


def test_parser_cache_returns_parsers():
    for key in LANGUAGES:
        parser = get_parser(key)
        assert parser.parse(b"int x;") is not None


def test_get_language_rejects_unknown():
    with pytest.raises(ValueError):
        get_language("rust")


def test_detect_language_from_filename():
    assert detect_language("solution.cpp") == "cpp"
    assert detect_language("solution.py") == "python"
    assert detect_language("Solution.java") == "java"
    assert detect_language("unknown.txt") == "cpp"


def test_scrub_code_strips_comments_all_languages():
    cases = {
        "cpp": "// line\nint main() { /* block */ return 0; }",
        "python": "# comment\ndef f():\n    return 0  # trailing",
        "java": "// line\nclass A { /* block */ int f() { return 0; } }",
    }
    for lang, code in cases.items():
        scrubbed = scrub_code(code, lang)
        assert " " not in scrubbed and "\n" not in scrubbed, lang
        assert "comment" not in scrubbed, lang


def test_normalize_ast_cpp():
    code = "int calcDist(int p1, int p2) { return p1 - p2; }"
    normalized, mapping = normalize_ast(code, "cpp")
    assert "calcDist" not in normalized and "func_0" in normalized
    assert "var_0" in normalized and "var_1" in normalized
    assert mapping["calcDist"] == "func_0"


def test_normalize_ast_python():
    code = "def compute_answer(items):\n    total = 0\n    for it in items:\n        total += it\n    return total"
    normalized, mapping = normalize_ast(code, "python")
    assert "compute_answer" not in normalized and "func_0" in normalized
    assert "var_0" in normalized
    # builtins must survive
    assert "total" not in normalized
    assert "range" in normalized or "len" in normalized or "return" in normalized


def test_normalize_ast_java():
    code = "class Solver { int findMax(int[] values) { int best = values[0]; return best; } }"
    normalized, mapping = normalize_ast(code, "java")
    assert "func_0" in normalized
    assert "var_0" in normalized
    assert "class" in normalized  # keyword untouched


def test_similarity_identical_python_code():
    code = "def solve(nums):\n    best = nums[0]\n    for n in nums:\n        if n > best:\n            best = n\n    return best"
    fg = get_fingerprints(code, k=10, w=5, language="python")
    fg2 = get_fingerprints(code + "\n# harmless comment", k=10, w=5, language="python")
    assert calculate_similarity(fg, fg2) > 0.85


def test_cfg_python_loops_and_branches():
    code = (
        "def route(points, stations):\n"
        "    battery = 100\n"
        "    for p in points:\n"
        "        battery -= p\n"
        "        if battery <= 0:\n"
        "            return False\n"
        "    return True\n"
    )
    graph, meta = CFGCompiler(code, "python").compile()
    types = [meta[n]["type"] for n in graph.nodes]
    assert "entry" in types and "loop" in types and "if" in types and "return" in types


def test_cfg_java_do_while_and_switch():
    code = (
        "class A {\n"
        "  int f(int x) {\n"
        "    int y = 0;\n"
        "    do { y++; x--; } while (x > 0);\n"
        "    switch (y) { case 1: y = 2; break; default: y = 3; }\n"
        "    return y;\n"
        "  }\n"
        "}\n"
    )
    graph, meta = CFGCompiler(code, "java").compile()
    types = [meta[n]["type"] for n in graph.nodes]
    assert "loop" in types and "switch" in types and "break" in types


def test_compare_cfgs_identical_python_functions_score_one():
    code = (
        "def solve(values):\n"
        "    acc = 0\n"
        "    for v in values:\n"
        "        acc += v\n"
        "    return acc\n"
    )
    g1, _ = CFGCompiler(code, "python").compile()
    g2, _ = CFGCompiler(code.replace("values", "data").replace("acc", "sum_"), "python").compile()
    assert compare_cfgs(g1, g2) == 1.0
