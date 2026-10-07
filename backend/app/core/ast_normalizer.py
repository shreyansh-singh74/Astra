from typing import Dict, Tuple

from backend.app.core.languages import get_language, get_parser


def _is_function_name(node, spec) -> bool:
    """
    True if this identifier is the *name* of a function/method/class definition:
      * C++   — identifier directly under a function_declarator
      * Py/Java — the 'name' field child of a function/class definition node
    """
    parent = node.parent
    if parent is None:
        return False
    if parent.type == "function_declarator":  # C++ definition site
        return True
    if parent.type in spec.func_def_nodes:
        name_node = parent.child_by_field_name("name")
        if name_node is not None and name_node.id == node.id:
            return True
    return False


def normalize_ast(code: str, language: str = "cpp") -> Tuple[str, Dict[str, str]]:
    """
    Parses code, strips comments, and anonymizes custom variables and function
    names to a standardized format (var_0, var_1, func_0, func_1).
    Returns the normalized code string and the identifier mapping dictionary.
    """
    spec = get_language(language)
    code_bytes = code.encode("utf-8")
    tree = get_parser(spec.key).parse(code_bytes)

    custom_functions = set()
    funcs_in_order = []
    variables = set()
    vars_in_order = []

    # 1. Identify custom functions and variables in order of appearance
    def collect_symbols(node):
        # Skip comment nodes entirely
        if node.type in spec.comment_nodes:
            return

        is_func_name = False
        # A function name is the identifier inside a function definition site
        if node.type in spec.identifier_nodes and node.child_count == 0 and _is_function_name(node, spec):
            name = code_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="ignore")
            if name not in spec.whitelist:
                if name not in funcs_in_order:
                    funcs_in_order.append(name)
                custom_functions.add(name)
                is_func_name = True

        if node.child_count == 0:
            if node.type in spec.identifier_nodes and not is_func_name:
                name = code_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="ignore")
                if name not in spec.whitelist and name not in custom_functions:
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
    replacements = []  # list of (start_byte, end_byte, replacement_string)

    def collect_replacements(node):
        if node.type in spec.comment_nodes:
            replacements.append((node.start_byte, node.end_byte, ""))
            return

        if node.child_count == 0:
            if node.type in spec.identifier_nodes:
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
