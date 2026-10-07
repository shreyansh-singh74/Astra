"""
OpenRouter client — powers the "Fetch AI answers" feature.

Generates reference solutions for an assignment's problem statement using
user-selected models (2-3 recommended), with per-variant style hints so that
even the same model produces structurally different candidates. Generated
code is validated against the language's tree-sitter grammar before it is
added to the AI vault.
"""
import re
from typing import Any, Dict, List, Optional

import httpx

from backend.app import db
from backend.app.core.app_settings import get_api_key
from backend.app.core.languages import get_parser

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
TIMEOUT_SECONDS = 180.0

CURATED_MODELS: List[Dict[str, str]] = [
    {"slug": "openai/gpt-4o-mini", "name": "ChatGPT (GPT-4o mini)", "vendor": "OpenAI"},
    {"slug": "anthropic/claude-3.7-sonnet", "name": "Claude Sonnet 3.7", "vendor": "Anthropic"},
    {"slug": "google/gemini-2.0-flash-001", "name": "Gemini 2.0 Flash", "vendor": "Google"},
]

VARIANT_STYLES = [
    "Write it in the most idiomatic style for the language, using the standard library "
    "containers and algorithms you would naturally choose.",
    "Write it in a straightforward procedural style with explicit loops and simple "
    "variables, avoiding helper functions where possible.",
    "Write it decomposed into small well-named helper functions, each responsible for "
    "one part of the logic.",
]


def _headers(api_key: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        # OpenRouter etiquette headers (attribution)
        "HTTP-Referer": "https://github.com/astra-forensic-console",
        "X-Title": "Astra Forensic Console",
    }


async def validate_key(api_key: str) -> Dict[str, Any]:
    """Lightweight GET /key check. Raises ValueError with a readable message."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{OPENROUTER_BASE}/key", headers=_headers(api_key))
    except httpx.HTTPError as exc:
        raise ValueError(f"Could not reach OpenRouter: {exc}") from exc

    if resp.status_code == 401:
        raise ValueError("OpenRouter rejected this API key (401 Unauthorized).")
    if resp.status_code != 200:
        raise ValueError(f"OpenRouter returned HTTP {resp.status_code} while validating the key.")
    return resp.json()


async def list_remote_models(api_key: str) -> List[Dict[str, str]]:
    """Live model catalog from OpenRouter (requires a key)."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{OPENROUTER_BASE}/models", headers=_headers(api_key))
    except httpx.HTTPError:
        return []
    if resp.status_code != 200:
        return []
    data = resp.json().get("data", [])
    models = []
    for m in data:
        models.append({
            "slug": m.get("id", ""),
            "name": m.get("name", m.get("id", "")),
            "vendor": (m.get("id", "").split("/", 1)[0] if "/" in m.get("id", "") else ""),
        })
    return models


def _build_prompt(problem_statement: str, language: str, variant: int) -> str:
    style = VARIANT_STYLES[variant % len(VARIANT_STYLES)]
    lang_name = {"cpp": "C++", "python": "Python 3", "java": "Java"}.get(language, language)
    return (
        f"Solve the following programming assignment in {lang_name}.\n\n"
        f"{problem_statement.strip()}\n\n"
        f"Requirements:\n"
        f"- Respond with ONE complete, self-contained {lang_name} source file and nothing else.\n"
        f"- No explanations, no markdown formatting outside the code.\n"
        f"- Include a small main function / driver only if the problem implies one.\n"
        f"- {style}\n"
    )


def _extract_code(text: str) -> str:
    """Pull the largest fenced code block out of an LLM response, else return raw text."""
    fences = re.findall(r"```(?:[a-zA-Z0-9+#.]*)\n(.*?)```", text, flags=re.DOTALL)
    if fences:
        return max(fences, key=len).strip()
    return text.strip()


def _has_syntax_errors(code: str, language: str) -> bool:
    """Tree-sitter based sanity check: reject generations that fail to parse."""
    try:
        tree = get_parser(language).parse(code.encode("utf-8"))
    except Exception:
        return True

    def walk(node) -> bool:
        if node.type in ("ERROR", "MISSING"):
            return True
        return any(walk(child) for child in node.children)

    return walk(tree.root_node)


async def generate_solution(
    problem_statement: str,
    language: str,
    model_slug: str,
    variant: int = 0,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Ask one OpenRouter model for a solution. Returns
    {"code": str, "raw": str, "model": slug, "valid": bool, "error": str|None}.
    Raises ValueError on transport/auth problems.
    """
    key = api_key or get_api_key()
    if not key:
        raise ValueError("No OpenRouter API key configured. Add one in Settings.")

    payload = {
        "model": model_slug,
        "messages": [
            {"role": "system", "content": "You are an expert competitive programmer and teaching assistant."},
            {"role": "user", "content": _build_prompt(problem_statement, language, variant)},
        ],
        "temperature": 0.8,
        "max_tokens": 4096,
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            resp = await client.post(
                f"{OPENROUTER_BASE}/chat/completions", headers=_headers(key), json=payload
            )
    except httpx.HTTPError as exc:
        raise ValueError(f"Could not reach OpenRouter: {exc}") from exc

    if resp.status_code == 401:
        raise ValueError("OpenRouter rejected the API key (401). Check it in Settings.")
    if resp.status_code == 402:
        raise ValueError("OpenRouter reported insufficient credits for this model.")
    if resp.status_code == 429:
        raise ValueError("OpenRouter rate limit hit (429). Try fewer models or retry shortly.")
    if resp.status_code != 200:
        detail = resp.text[:300]
        raise ValueError(f"OpenRouter returned HTTP {resp.status_code}: {detail}")

    try:
        body = resp.json()
        raw_text = body["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, ValueError) as exc:
        raise ValueError(f"Unexpected OpenRouter response shape: {exc}") from exc

    code = _extract_code(raw_text)
    if not code:
        return {"code": "", "raw": raw_text, "model": model_slug, "valid": False,
                "error": "Model returned an empty response."}

    if _has_syntax_errors(code, language):
        return {"code": code, "raw": raw_text, "model": model_slug, "valid": False,
                "error": "Generated code failed syntax validation."}

    return {"code": code, "raw": raw_text, "model": model_slug, "valid": True, "error": None}
