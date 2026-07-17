import networkx as nx
from typing import Dict, List, Any, Tuple
from tree_sitter import Language, Parser
import tree_sitter_cpp as ts_cpp

# Initialize C++ parser
CPP_LANGUAGE = Language(ts_cpp.language())
parser = Parser(CPP_LANGUAGE)

class CFGCompiler:
    def __init__(self, code: str):
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
        tree = parser.parse(self.code_bytes)
        self._traverse_ast(tree.root_node, [], [], [])
        return self.graph, self.node_metadata

    def _traverse_ast(self, ast_node, parents: List[str], break_targets: List[str], continue_targets: List[str]) -> List[str]:
        """
        Recursively walks the AST and builds CFG nodes and edges.
        Returns the list of exit CFG node IDs for the current sub-tree.
        """
        if ast_node.type in ("comment", "line_comment", "block_comment"):
            return parents
        
        # 1. Handle Function Definition
        if ast_node.type == "function_definition":
            func_name = ""
            # Try to find the function name identifier
            declarator = ast_node.child_by_field_name("declarator")
            if declarator:
                # function_declarator is nested inside other declarators sometimes
                inner = declarator
                while inner and inner.type != "identifier":
                    if inner.child_count > 0:
                        # find identifier
                        found = False
                        for child in inner.children:
                            if child.type == "identifier":
                                func_name = self.code_bytes[child.start_byte:child.end_byte].decode("utf-8", errors="ignore")
                                found = True
                                break
                        if found:
                            break
                        inner = inner.children[0]
                    else:
                        break
            
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

        # 2. Compound Statement (Block of code)
        elif ast_node.type == "compound_statement":
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
                
            consequent = ast_node.child_by_field_name("consequent")
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

        # 4. While Statement
        elif ast_node.type == "while_statement":
            while_id = self._new_node("loop", "While Loop", ast_node)
            for p in parents:
                self.graph.add_edge(p, while_id)
                
            loop_end_id = self._new_node("loop_end", "While End", ast_node)
            
            body = ast_node.child_by_field_name("body")
            if body:
                body_exits = self._traverse_ast(body, [while_id], break_targets + [loop_end_id], continue_targets + [while_id])
                for be in body_exits:
                    self.graph.add_edge(be, while_id)
                    
            self.graph.add_edge(while_id, loop_end_id)
            return [loop_end_id]

        # 5. For Statement
        elif ast_node.type == "for_statement":
            for_id = self._new_node("loop", "For Loop", ast_node)
            for p in parents:
                self.graph.add_edge(p, for_id)
                
            loop_end_id = self._new_node("loop_end", "For End", ast_node)
            
            body = ast_node.child_by_field_name("body")
            if body:
                body_exits = self._traverse_ast(body, [for_id], break_targets + [loop_end_id], continue_targets + [for_id])
                for be in body_exits:
                    self.graph.add_edge(be, for_id)
                    
            self.graph.add_edge(for_id, loop_end_id)
            return [loop_end_id]

        # 6. Return Statement
        elif ast_node.type == "return_statement":
            ret_id = self._new_node("return", "Return", ast_node)
            for p in parents:
                self.graph.add_edge(p, ret_id)
            return [] # Returns terminate execution path in this block

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
        elif ast_node.type in ("expression_statement", "declaration_statement"):
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
