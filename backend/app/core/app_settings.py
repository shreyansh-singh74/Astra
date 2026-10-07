"""
Central app settings stored in the settings table with code-level defaults.
Covers pipeline thresholds, fusion weights, and the OpenRouter API key.
"""
import json
from typing import Dict, Any

from backend.app import db

KEY_API = "openrouter_api_key"
KEY_WEIGHTS = "weights"
KEY_SIEVE = "sieve_threshold"
KEY_COLLUSION = "collusion_threshold"
KEY_DEFAULT_MODELS = "default_models"

DEFAULT_WEIGHTS = {"token": 0.20, "ast": 0.20, "cfg": 0.20, "semantic": 0.40}
DEFAULT_SIEVE = 0.10
# Calibrated against real CodeBERT corpus-centered scores: renamed copies of a
# classmate's solution land ≈0.6-0.75, independent solutions ≈0.15-0.2.
DEFAULT_COLLUSION = 0.60
DEFAULT_MODELS = ["openai/gpt-4o-mini", "google/gemini-2.0-flash-001", "deepseek/deepseek-chat-v3-0324:free"]


def get_api_key() -> str:
    return db.get_setting(KEY_API, "") or ""


def set_api_key(key: str) -> None:
    db.set_setting(KEY_API, key)


def get_weights() -> Dict[str, float]:
    raw = db.get_setting(KEY_WEIGHTS)
    if not raw:
        return dict(DEFAULT_WEIGHTS)
    try:
        stored = json.loads(raw)
        merged = dict(DEFAULT_WEIGHTS)
        merged.update({k: float(v) for k, v in stored.items() if k in merged})
        return merged
    except (ValueError, TypeError):
        return dict(DEFAULT_WEIGHTS)


def set_weights(weights: Dict[str, float]) -> None:
    merged = dict(DEFAULT_WEIGHTS)
    merged.update({k: float(v) for k, v in weights.items() if k in merged})
    total = sum(merged.values())
    if total <= 0:
        raise ValueError("Weights must sum to a positive value")
    db.set_setting(KEY_WEIGHTS, json.dumps(merged))


def get_sieve_threshold() -> float:
    try:
        return float(db.get_setting(KEY_SIEVE, DEFAULT_SIEVE))
    except (TypeError, ValueError):
        return DEFAULT_SIEVE


def set_sieve_threshold(value: float) -> None:
    db.set_setting(KEY_SIEVE, str(float(value)))


def get_collusion_threshold() -> float:
    try:
        return float(db.get_setting(KEY_COLLUSION, DEFAULT_COLLUSION))
    except (TypeError, ValueError):
        return DEFAULT_COLLUSION


def set_collusion_threshold(value: float) -> None:
    db.set_setting(KEY_COLLUSION, str(float(value)))


MODEL_REMAP = {
    "openai/gpt-4o": "openai/gpt-4o-mini",
    "anthropic/claude-3.5-sonnet": "anthropic/claude-3.7-sonnet",
    "anthropic/claude-sonnet-4": "anthropic/claude-3.7-sonnet",
    "google/gemini-flash-1.5": "google/gemini-2.0-flash-001",
}

def get_default_models() -> list:
    raw = db.get_setting(KEY_DEFAULT_MODELS)
    if not raw:
        return list(DEFAULT_MODELS)
    try:
        stored = json.loads(raw)
        if isinstance(stored, list) and stored:
            return [MODEL_REMAP.get(str(m), str(m)) for m in stored]
        return list(DEFAULT_MODELS)
    except (ValueError, TypeError):
        return list(DEFAULT_MODELS)


def set_default_models(models: list) -> None:
    cleaned = [str(m).strip() for m in models if str(m).strip()]
    if not cleaned:
        raise ValueError("Default models must be a non-empty list")
    db.set_setting(KEY_DEFAULT_MODELS, json.dumps(cleaned))


def snapshot() -> Dict[str, Any]:
    """All tunable settings (API key redacted to a boolean)."""
    return {
        "has_api_key": bool(get_api_key()),
        "weights": get_weights(),
        "sieve_threshold": get_sieve_threshold(),
        "collusion_threshold": get_collusion_threshold(),
        "default_models": get_default_models(),
    }
