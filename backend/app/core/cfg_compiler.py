import networkx as nx
from typing import Any, Dict, List, Tuple

from backend.app.core.languages import get_language, get_parser


class CFGCompiler:
    """
    Compiles a Control Flow Graph from source code using tree-sitter.

    Node types are language-agnostic (entry, exit, if, loop, loop_end, return,
    break, continue, switch, statement) so that CFGs of different submissions
    in the same language are directly comparable via the WL kernel.
    """

    def __init__(self, code: str, language: str = "cpp"):
        self.spec = get_language(language)
        self.code = code
        self.code_bytes = code.encode("utf-8")
        self.node_counter = 0
        self.graph = nx.DiGraph()
        self.node_metadata = {}

    def _new_node(self, node_type: str, label: str, ast_node=None) -> str:
        nid = f"n{self.node_counter}"
        self.node_counter += 1

        metadata = {
            "id": nid,
            "type": node_type,
            "label": label,
            "start_byte": 0,
            "end_byte": 0,
            "start_line": 0,
            "end_line": 0,
            "code": ""
        }

        if ast_node is not None:
            metadata["start_byte"] = ast_node.start_byte
            metadata["end_byte"] = ast_node.end_byte
            metadata["start_line"] = ast_node.start_point[0]
            metadata["end_line"] = ast_node.end_point[0]
            metadata["code"] = self.code_bytes[ast_node.start_byte:ast_node.end_byte].decode("utf-8", errors="ignore")

        self.graph.add_node(nid, type=node_type, label=label)
        self.node_metadata[nid] = metadata
        return nid

    def compile(self) -> Tuple[nx.DiGraph, Dict[str, Any]]:
        """
        Compiles a CFG for all functions defined in the code.
        Returns the NetworkX DiGraph and a dictionary of node metadata.
        """
        tree = get_parser(self.spec.key).parse(self.code_bytes)
        self._traverse_ast(tree.root_node, [], [], [])
        return self.graph, self.node_metadata

    def _extract_function_name(self, ast_node) -> str:
        # Py/Java: the definition node has a 'name' field
        name_node = ast_node.child_by_field_name("name")
        if name_node is not None:
            return self.code_bytes[name_node.start_byte:name_node.end_byte].decode("utf-8", errors="ignore")

        # C++: the name identifier is nested inside the declarator chain
        declarator = ast_node.child_by_field_name("declarator")
        inner = declarator
        while inner and inner.type != "identifier":
            if inner.child_count > 0:
                for child in inner.children:
                    if child.type == "identifier":
                        return self.code_bytes[child.start_byte:child.end_byte].decode("utf-8", errors="ignore")
                inner = inner.children[0]
            else:
                break
        return ""

    def _traverse_ast_generic_children(self, ast_node, parents, break_targets, continue_targets):
        curr = parents
        for child in ast_node.children:
            curr = self._traverse_ast(child, curr, break_targets, continue_targets)
        return curr

    def _traverse_ast(self, ast_node, parents: List[str], break_targets: List[str], continue_targets: List[str]) -> List[str]:
        """
        Recursively walks the AST and builds CFG nodes and edges.
        Returns the list of exit CFG node IDs for the current sub-tree.
        """
        if ast_node.type in self.spec.comment_nodes:
            return parents

        # 1. Handle Function / Class Definition
        if ast_node.type in self.spec.func_def_nodes:
            func_name = self._extract_function_name(ast_node)

            if ast_node.type in ("class_declaration", "class_definition"):
                label = f"Class: {func_name}" if func_name else "Class"
            else:
                label = f"Function Entry: {func_name}" if func_name else "Function Entry"
            entry_id = self._new_node("entry", label, ast_node)
            for p in parents:
                self.graph.add_edge(p, entry_id)

            body = ast_node.child_by_field_name("body")
            if body:
                body_exits = self._traverse_ast(body, [entry_id], [], [])
                exit_id = self._new_node("exit", "Function Exit", ast_node)
                for be in body_exits:
                    self.graph.add_edge(be, exit_id)
                return [exit_id]
            else:
                return [entry_id]

        # 2. Block of code
        elif ast_node.type in self.spec.block_nodes:
            curr_parents = parents
            for child in ast_node.children:
                if child.type not in ("{", "}"):
                    curr_parents = self._traverse_ast(child, curr_parents, break_targets, continue_targets)
            return curr_parents

        # 3. If Statement
        elif ast_node.type == "if_statement":
            if_id = self._new_node("if", "If Check", ast_node)
            for p in parents:
                self.graph.add_edge(p, if_id)

            consequent = ast_node.child_by_field_name(self.spec.then_field)
            alternative = ast_node.child_by_field_name("alternative")

            true_exits = []
            if consequent:
                true_exits = self._traverse_ast(consequent, [if_id], break_targets, continue_targets)
            else:
                true_exits = [if_id]

            false_exits = []
            if alternative:
                false_exits = self._traverse_ast(alternative, [if_id], break_targets, continue_targets)
            else:
                false_exits = [if_id]

            return list(set(true_exits + false_exits))

        # 4. Loops (while / for / do-while)
        elif ast_node.type in self.spec.loop_nodes:
            kind = "While Loop" if ast_node.type == "while_statement" else (
                "Do-While Loop" if ast_node.type == "do_statement" else "For Loop"
            )
            loop_id = self._new_node("loop", kind, ast_node)
            for p in parents:
                self.graph.add_edge(p, loop_id)

            loop_end_id = self._new_node("loop_end", f"{kind.split()[0]} End", ast_node)

            body = ast_node.child_by_field_name("body")
            if body:
                body_exits = self._traverse_ast(body, [loop_id], break_targets + [loop_end_id], continue_targets + [loop_id])
                for be in body_exits:
                    self.graph.add_edge(be, loop_id)

            self.graph.add_edge(loop_id, loop_end_id)
            return [loop_end_id]

        # 5. Switch Statement (branch node; Java also parses switches as switch_expression)
        elif ast_node.type in ("switch_statement", "switch_expression",
                               "try_statement", "try_with_resources_statement",
                               "elif_clause"):
            kind = "Switch" if "switch" in ast_node.type else (
                "Try" if "try" in ast_node.type else "Elif")
            node_kind = "switch" if "switch" in ast_node.type else "if"
            branch_id = self._new_node(node_kind, kind, ast_node)
            for p in parents:
                self.graph.add_edge(p, branch_id)

            end_id = self._new_node(f"{node_kind}_end", f"{kind} End", ast_node)

            body = ast_node.child_by_field_name("body")
            if body is None:
                body = next(
                    (c for c in ast_node.children if c.type in ("switch_block", "compound_statement", "block")),
                    None,
                )
            if body:
                exits = self._traverse_ast(
                    body, [branch_id], break_targets + [end_id], continue_targets
                )
                for e in exits:
                    self.graph.add_edge(e, end_id)
                # try/catch/finally handlers also flow into the join
                for child in ast_node.children:
                    if child.type in ("catch_clause", "catch_type", "finally_clause",
                                      "except_clause", "else_clause", "alternative"):
                        hexits = self._traverse_ast(child, [branch_id], break_targets, continue_targets)
                        for e in hexits:
                            self.graph.add_edge(e, end_id)
                return [end_id]
            # fallthrough: traverse children generically from the branch
            exits = self._traverse_ast_generic_children(ast_node, [branch_id], break_targets, continue_targets)
            for e in exits:
                self.graph.add_edge(e, end_id)
            return [end_id]

        # 6. Return Statement
        elif ast_node.type == "return_statement":
            ret_id = self._new_node("return", "Return", ast_node)
            for p in parents:
                self.graph.add_edge(p, ret_id)
            return []  # Returns terminate execution path in this block

        # 7. Break Statement
        elif ast_node.type == "break_statement":
            break_id = self._new_node("break", "Break", ast_node)
            for p in parents:
                self.graph.add_edge(p, break_id)
            if break_targets:
                self.graph.add_edge(break_id, break_targets[-1])
            return []

        # 8. Continue Statement
        elif ast_node.type == "continue_statement":
            cont_id = self._new_node("continue", "Continue", ast_node)
            for p in parents:
                self.graph.add_edge(p, cont_id)
            if continue_targets:
                self.graph.add_edge(cont_id, continue_targets[-1])
            return []

        # 9. Normal Statements (Expressions, Declarations)
        elif ast_node.type in self.spec.statement_nodes:
            stmt_id = self._new_node("statement", "Statement", ast_node)
            for p in parents:
                self.graph.add_edge(p, stmt_id)
            return [stmt_id]

        # For other types, traverse child nodes recursively (without introducing CFG nodes)
        curr_parents = parents
        for child in ast_node.children:
            curr_parents = self._traverse_ast(child, curr_parents, break_targets, continue_targets)
        return curr_parents


def compare_cfgs(g1: nx.DiGraph, g2: nx.DiGraph) -> float:
    """
    Computes a similarity score [0.0 - 1.0] between two CFGs by combining:
    1. Node type distribution Jaccard similarity.
    2. Edge count similarity.
    3. Weisfeiler-Lehman Graph Isomorphism Kernel.
    """
    if g1.number_of_nodes() == 0 or g2.number_of_nodes() == 0:
        return 0.0

    types1 = [g1.nodes[n].get("type", "") for n in g1.nodes]
    types2 = [g2.nodes[n].get("type", "") for n in g2.nodes]

    from collections import Counter
    c1 = Counter(types1)
    c2 = Counter(types2)

    intersection = sum((c1 & c2).values())
    union = sum((c1 | c2).values())
    node_similarity = intersection / union if union > 0 else 0.0

    # WL Kernel Similarity
    try:
        h1 = nx.weisfeiler_lehman_graph_hash(g1, node_attr="type", iterations=3)
        h2 = nx.weisfeiler_lehman_graph_hash(g2, node_attr="type", iterations=3)
        wl_similarity = 1.0 if h1 == h2 else 0.0
    except Exception:
        wl_similarity = 0.0

    if wl_similarity == 1.0:
        return 1.0

    # Fallback to Jaccard of nodes and edge ratios
    edge_diff = abs(g1.number_of_edges() - g2.number_of_edges())
    max_edges = max(g1.number_of_edges(), g2.number_of_edges(), 1)
    edge_similarity = 1.0 - (edge_diff / max_edges)

    return 0.6 * node_similarity + 0.4 * edge_similarity
