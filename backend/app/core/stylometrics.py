"""
Stylometric Feature Extractor for Astra Forensic Engine.

Extracts unconfounded, code-structure statistical features:
1. Comment Density (ratio of comment lines to code lines)
2. Indentation Depth Variance (structural regularity indicator)
3. Custom Identifier Length Mean & Variance (naming style profile)
4. Maximum Block Nesting Depth (control flow complexity)
5. Defensive Check Ratio (bounds/null checks relative to statements)
6. Average Line Length & Blank Line Ratio
"""
import math
import re
from typing import Dict, List
import numpy as np

from backend.app.core.languages import get_language, get_parser


def extract_stylometric_features(code: str, language: str = "cpp") -> Dict[str, float]:
    lines = code.splitlines()
    total_lines = len(lines)
    if total_lines == 0:
        return {
            "line_count": 0,
            "comment_density": 0.0,
            "indent_std": 0.0,
            "id_len_mean": 0.0,
            "id_len_std": 0.0,
            "max_nesting_depth": 0,
            "defensive_ratio": 0.0,
            "avg_line_length": 0.0,
            "blank_line_ratio": 0.0,
        }

    # 1. Line metrics
    blank_lines = sum(1 for line in lines if not line.strip())
    non_blank_lines = total_lines - blank_lines
    blank_line_ratio = blank_lines / total_lines
    avg_line_length = sum(len(line) for line in lines) / total_lines

    # 2. Comments & Indentation
    comment_lines = 0
    indents = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith(("//", "#", "/*", "*", "'''", '"""')):
            comment_lines += 1
        else:
            indent = len(line) - len(line.lstrip())
            indents.append(indent)

    comment_density = comment_lines / max(non_blank_lines, 1)
    indent_std = float(np.std(indents)) if len(indents) > 1 else 0.0

    # 3. Parsing with Tree-Sitter for AST-based features
    spec = get_language(language)
    code_bytes = code.encode("utf-8")
    tree = get_parser(spec.key).parse(code_bytes)

    identifiers = []
    max_nesting = [0]
    defensive_checks = [0]
    statements = [0]

    def walk(node, depth: int):
        if node.type in spec.comment_nodes:
            return

        if depth > max_nesting[0]:
            max_nesting[0] = depth

        # Collect identifiers
        if node.type in spec.identifier_nodes and node.child_count == 0:
            name = code_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="ignore")
            if name and name not in spec.whitelist:
                identifiers.append(name)

        # Count defensive check branches & statements
        if node.type in ("if_statement", "try_statement", "catch_clause", "assert_statement"):
            defensive_checks[0] += 1
        if node.type in spec.statement_nodes:
            statements[0] += 1

        new_depth = depth + 1 if node.type in spec.block_nodes or node.type in spec.loop_nodes else depth
        for child in node.children:
            walk(child, new_depth)

    walk(tree.root_node, 0)

    # Identifier length statistics
    if identifiers:
        id_lens = [len(i) for i in identifiers]
        id_len_mean = float(np.mean(id_lens))
        id_len_std = float(np.std(id_lens))
    else:
        id_len_mean = 0.0
        id_len_std = 0.0

    defensive_ratio = defensive_checks[0] / max(statements[0], 1)

    return {
        "line_count": float(total_lines),
        "comment_density": float(comment_density),
        "indent_std": float(indent_std),
        "id_len_mean": float(id_len_mean),
        "id_len_std": float(id_len_std),
        "max_nesting_depth": float(max_nesting[0]),
        "defensive_ratio": float(defensive_ratio),
        "avg_line_length": float(avg_line_length),
        "blank_line_ratio": float(blank_line_ratio),
    }
