"""
Language registry for the multi-tier pipeline.

Each supported language carries everything the tiers need: its tree-sitter
grammar, comment/identifier node types, a whitelist of names that must never
be anonymized by the AST tier, the AST node types that define
functions/blocks/statements (used by the CFG compiler), file extensions, and
the Monaco editor language id used by the frontend.
"""
from dataclasses import dataclass, field
from typing import Dict, Optional

from tree_sitter import Language, Parser
import tree_sitter_cpp as ts_cpp
import tree_sitter_python as ts_py
import tree_sitter_java as ts_java


CPP_KEYWORDS = {
    "int", "double", "float", "char", "bool", "void", "size_t", "long", "short", "unsigned", "signed",
    "if", "else", "for", "while", "do", "switch", "case", "default", "break", "continue", "return",
    "true", "false", "NULL", "nullptr",
    "const", "struct", "class", "public", "private", "protected", "template", "typename",
    "inline", "auto", "virtual", "override", "static", "extern", "using", "namespace",
    "std", "vector", "pair", "list", "map", "set", "unordered_map", "unordered_set", "string",
    "first", "second", "abs", "fabs", "find", "begin", "end", "size", "push_back", "pop_back",
    "insert", "erase", "clear", "min", "max", "sort", "algorithm", "cmath", "cstdlib",
    "main", "cout", "cin", "endl", "queue", "stack", "deque", "priority_queue", "multiset",
    "make_pair", "make_tuple", "getline", "swap", "count", "upper_bound", "lower_bound",
    "memset", "sqrt", "pow", "floor", "ceil", "round",
}

PYTHON_KEYWORDS = {
    "def", "return", "if", "elif", "else", "for", "while", "break", "continue", "pass",
    "import", "from", "as", "class", "try", "except", "finally", "with", "lambda", "yield",
    "global", "nonlocal", "assert", "del", "raise", "in", "is", "not", "and", "or",
    "None", "True", "False", "self", "cls", "async", "await", "match", "case",
    "print", "len", "range", "abs", "min", "max", "sum", "sorted", "list", "dict", "set",
    "tuple", "int", "float", "str", "bool", "enumerate", "zip", "map", "filter", "reversed",
    "any", "all", "input", "open", "isinstance", "type", "super", "round", "divmod", "pow",
    "format", "range", "frozenset", "bytes", "complex", "slice", "hash", "id", "iter", "next",
    "append", "extend", "insert", "remove", "pop", "clear", "index", "count", "sort",
    "reverse", "copy", "keys", "values", "items", "get", "update", "add", "discard",
    "union", "join", "split", "strip", "lstrip", "rstrip", "startswith", "endswith",
    "replace", "find", "lower", "upper", "title", "capitalize", "encode", "decode",
    "isdigit", "isalpha", "isalnum", "islower", "isupper", "ljust", "rjust", "center",
    "__init__", "__str__", "__repr__", "__len__", "__eq__", "__lt__", "__contains__",
    "__iter__", "__next__", "__getitem__", "__setitem__", "__name__", "__main__",
}

JAVA_KEYWORDS = {
    "public", "private", "protected", "static", "final", "void", "int", "long", "double",
    "float", "boolean", "char", "byte", "short", "var", "class", "interface", "enum",
    "extends", "implements", "new", "return", "if", "else", "for", "while", "do", "switch",
    "case", "default", "break", "continue", "try", "catch", "finally", "throw", "throws",
    "import", "package", "this", "super", "null", "true", "false", "instanceof",
    "abstract", "synchronized", "volatile", "transient", "native",
    "System", "out", "println", "print", "printf", "Math", "abs", "min", "max", "sqrt",
    "pow", "floor", "ceil", "String", "length", "charAt", "substring", "equals",
    "compareTo", "indexOf", "split", "trim", "toUpperCase", "toLowerCase",
    "Integer", "parseInt", "parseDouble", "parseLong", "Double", "Long", "Boolean",
    "Character", "List", "ArrayList", "LinkedList", "Map", "HashMap", "TreeMap",
    "LinkedHashMap", "Set", "HashSet", "TreeSet", "Queue", "Deque", "ArrayDeque",
    "PriorityQueue", "Stack", "Arrays", "Collections", "sort", "add", "get", "set",
    "remove", "size", "isEmpty", "contains", "containsKey", "put", "keySet", "values",
    "entrySet", "stream", "map", "filter", "collect", "Collectors", "toList", "Iterator",
    "hasNext", "next", "main", "Object", "toString", "hashCode", "Optional", "of",
    "Scanner", "BufferedReader", "InputStreamReader", "StringBuilder", "append",
}


@dataclass(frozen=True)
class LanguageSpec:
    key: str
    name: str
    ts_language: Language
    comment_nodes: frozenset
    identifier_nodes: frozenset
    func_def_nodes: frozenset          # AST nodes that define a function/method
    block_nodes: frozenset             # AST nodes holding a statement sequence
    loop_nodes: frozenset              # loops (body field flows back)
    statement_nodes: frozenset         # plain statements that become CFG nodes
    then_field: str                    # tree-sitter field name of the if-then branch
    whitelist: frozenset
    extensions: tuple
    monaco: str


def _spec(
    key: str,
    name: str,
    ts_language: Language,
    comment_nodes,
    identifier_nodes,
    func_def_nodes,
    block_nodes,
    loop_nodes,
    statement_nodes,
    then_field: str,
    whitelist,
    extensions,
    monaco: str,
) -> LanguageSpec:
    return LanguageSpec(
        key=key,
        name=name,
        ts_language=ts_language,
        comment_nodes=frozenset(comment_nodes),
        identifier_nodes=frozenset(identifier_nodes),
        func_def_nodes=frozenset(func_def_nodes),
        block_nodes=frozenset(block_nodes),
        loop_nodes=frozenset(loop_nodes),
        statement_nodes=frozenset(statement_nodes),
        then_field=then_field,
        whitelist=frozenset(whitelist),
        extensions=tuple(extensions),
        monaco=monaco,
    )


LANGUAGES: Dict[str, LanguageSpec] = {
    "cpp": _spec(
        "cpp", "C++", Language(ts_cpp.language()),
        comment_nodes={"comment"},
        identifier_nodes={"identifier", "field_identifier", "type_identifier"},
        func_def_nodes={"function_definition"},
        block_nodes={"compound_statement"},
        loop_nodes={"while_statement", "for_statement"},
        statement_nodes={"expression_statement", "declaration_statement"},
        then_field="consequent",
        whitelist=CPP_KEYWORDS,
        extensions=(".cpp", ".cxx", ".cc", ".c", ".h", ".hpp"),
        monaco="cpp",
    ),
    "python": _spec(
        "python", "Python", Language(ts_py.language()),
        comment_nodes={"comment"},
        identifier_nodes={"identifier"},
        # class names are normalized like function names (func_N)
        func_def_nodes={"function_definition", "class_definition"},
        block_nodes={"block"},
        loop_nodes={"while_statement", "for_statement"},
        statement_nodes={"expression_statement", "with_statement", "assert_statement"},
        then_field="consequence",
        whitelist=PYTHON_KEYWORDS,
        extensions=(".py",),
        monaco="python",
    ),
    "java": _spec(
        "java", "Java", Language(ts_java.language()),
        comment_nodes={"line_comment", "block_comment"},
        identifier_nodes={"identifier", "type_identifier"},
        func_def_nodes={"method_declaration", "constructor_declaration", "class_declaration"},
        block_nodes={"block"},
        loop_nodes={"while_statement", "for_statement", "do_statement"},
        statement_nodes={"expression_statement", "local_variable_declaration"},
        then_field="consequence",
        whitelist=JAVA_KEYWORDS,
        extensions=(".java",),
        monaco="java",
    ),
}

_parsers: Dict[str, Parser] = {}


def get_parser(language: str) -> Parser:
    spec = get_language(language)
    if spec.key not in _parsers:
        parser = Parser(spec.ts_language)
        _parsers[spec.key] = parser
    return _parsers[spec.key]


def get_language(language: str) -> LanguageSpec:
    key = (language or "cpp").lower()
    if key in LANGUAGES:
        return LANGUAGES[key]
    aliases = {"c++": "cpp", "py": "python", "py3": "python", "java": "java"}
    if key in aliases:
        return LANGUAGES[aliases[key]]
    raise ValueError(f"Unsupported language: {language!r} (supported: {', '.join(LANGUAGES)})")


def detect_language(filename: str) -> str:
    """Pick the pipeline language from a file extension; defaults to cpp."""
    name = (filename or "").lower()
    for spec in LANGUAGES.values():
        if name.endswith(spec.extensions):
            return spec.key
    return "cpp"


def is_identifier_leaf(node, spec: LanguageSpec) -> bool:
    return node.type in spec.identifier_nodes
