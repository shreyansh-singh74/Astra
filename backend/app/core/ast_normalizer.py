from typing import Dict, List, Set, Tuple
from tree_sitter import Language, Parser
import tree_sitter_cpp as ts_cpp

# Initialize C++ parser
CPP_LANGUAGE = Language(ts_cpp.language())
parser = Parser(CPP_LANGUAGE)

# Whitelist of C++ keywords, standard libraries, and common symbols that should not be anonymized.
WHITELIST = {
    # Types
    "int", "double", "float", "char", "bool", "void", "size_t", "long", "short", "unsigned", "signed",
    # Control Flow
    "if", "else", "for", "while", "do", "switch", "case", "default", "break", "continue", "return",
    # Constants
    "true", "false", "NULL", "nullptr",
    # Keywords
    "const", "struct", "class", "public", "private", "protected", "template", "typename", 
    "inline", "auto", "virtual", "override", "static", "extern", "using", "namespace",
    # STL Containers and Namespaces
    "std", "vector", "pair", "list", "map", "set", "unordered_map", "unordered_set", "string",
    # STL Methods and Algorithms
    "first", "second", "abs", "fabs", "find", "begin", "end", "size", "push_back", "pop_back", 
    "insert", "erase", "clear", "min", "max", "sort", "algorithm", "cmath", "cstdlib",
    # Standard Function Names
    "main"
}

def normalize_ast(code: str) -> Tuple[str, Dict[str, str]]:
    """
    Parses C++ code, strips comments, and anonymizes custom variables and function names
    to a standardized format (var_0, var_1, func_0, func_1).
    Returns the normalized code string and the identifier mapping dictionary.
    """
    code_bytes = code.encode("utf-8")
    tree = parser.parse(code_bytes)
    
    custom_functions = set()
    funcs_in_order = []
    variables = set()
    vars_in_order = []
    
    # 1. Identify custom functions and variables in order of appearance
    def collect_symbols(node):
        # Skip comment nodes entirely
        if node.type in ("comment", "line_comment", "block_comment"):
            return
        
        is_func_name = False
        # A function name is the identifier inside a function_declarator
        if node.type == "identifier" and node.parent and node.parent.type == "function_declarator":
            name = code_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="ignore")
            if name not in WHITELIST:
                if name not in funcs_in_order:
                    funcs_in_order.append(name)
                custom_functions.add(name)
                is_func_name = True
                
        if node.child_count == 0:
            if node.type in ("identifier", "field_identifier", "type_identifier") and not is_func_name:
                name = code_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="ignore")
                if name not in WHITELIST and name not in custom_functions:
                    if name not in vars_in_order:
                        vars_in_order.append(name)
                    variables.add(name)
            return
        
        for child in node.children:
            collect_symbols(child)
            
    collect_symbols(tree.root_node)
    
    # 2. Build the mappings
    symbol_map = {}
    for idx, func in enumerate(funcs_in_order):
        symbol_map[func] = f"func_{idx}"
    for idx, var in enumerate(vars_in_order):
        symbol_map[var] = f"var_{idx}"
        
    # 3. Traverse again to collect replacements (comments to empty, identifiers to mapped names)
    replacements = [] # list of (start_byte, end_byte, replacement_string)
    
    def collect_replacements(node):
        if node.type in ("comment", "line_comment", "block_comment"):
            replacements.append((node.start_byte, node.end_byte, ""))
            return
        
        if node.child_count == 0:
            if node.type in ("identifier", "field_identifier", "type_identifier"):
                name = code_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="ignore")
                if name in symbol_map:
                    replacements.append((node.start_byte, node.end_byte, symbol_map[name]))
            return
        
        for child in node.children:
            collect_replacements(child)
            
    collect_replacements(tree.root_node)
    
    # Sort replacements by start_byte in reverse order to apply them from back to front
    replacements.sort(key=lambda x: x[0], reverse=True)
    
    # Apply replacements
    modified_bytes = bytearray(code_bytes)
    for start, end, repl in replacements:
        modified_bytes[start:end] = repl.encode("utf-8")
        
    normalized_code = modified_bytes.decode("utf-8", errors="ignore")
    return normalized_code, symbol_map
