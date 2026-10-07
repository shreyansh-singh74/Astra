import asyncio
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.app import db
from backend.app.core import app_settings
from backend.app.core.openrouter_client import (
    CURATED_MODELS,
    generate_solution,
    list_remote_models,
    validate_key,
)

router = APIRouter(prefix="/api/openrouter", tags=["openrouter"])


class KeyRequest(BaseModel):
    api_key: str


class GenerateRequest(BaseModel):
    models: List[str]
    language: str = "cpp"
    problem_statement: Optional[str] = None
    variants_per_model: int = 1


@router.get("/status")
def status():
    return {"has_key": bool(app_settings.get_api_key())}


@router.post("/key")
async def set_key(body: KeyRequest):
    key = body.api_key.strip()
    if not key:
        raise HTTPException(status_code=422, detail="API key must not be empty.")
    try:
        await validate_key(key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    app_settings.set_api_key(key)
    return {"ok": True, "has_key": True}


@router.delete("/key")
def remove_key():
    app_settings.set_api_key("")
    return {"ok": True, "has_key": False}


@router.get("/models")
async def models():
    curated = [dict(m) for m in CURATED_MODELS]
    return {"curated": curated, "live": [], "has_key": bool(app_settings.get_api_key())}


@router.post("/assignments/{assignment_id}/vault/generate")
async def generate_references(assignment_id: int, body: GenerateRequest):
    assignment = db.get_assignment(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    if not app_settings.get_api_key():
        raise HTTPException(
            status_code=400,
            detail="No OpenRouter API key configured. Add one in Settings first.",
        )
    if not body.models:
        raise HTTPException(status_code=422, detail="Select at least one model to generate with.")

    problem = (body.problem_statement or assignment["problem_statement"]
               or assignment["description"] or "").strip()
    if not problem:
        raise HTTPException(
            status_code=422,
            detail="Assignment has no problem statement to generate solutions from.",
        )

    variants = max(1, min(int(body.variants_per_model), 3))

    async def run_one(slug: str) -> dict:
        generated = []
        for variant in range(variants):
            try:
                result = await generate_solution(problem, body.language, slug, variant=variant)
            except ValueError as exc:
                generated.append({"model": slug, "variant": variant, "valid": False, "error": str(exc)})
                continue
            reference_id = None
            if result["valid"]:
                model_name = _pretty_name(slug)
                reference_id = db.add_reference(
                    assignment_id=assignment_id,
                    model_key=slug.replace("/", "_"),
                    model_name=model_name if variants == 1 else f"{model_name} v{variant + 1}",
                    code=result["code"],
                    source="openrouter",
                    language=body.language,
                )
            generated.append({
                "model": slug,
                "variant": variant,
                "valid": result["valid"],
                "error": result["error"],
                "code": result["code"],
                "reference_id": reference_id,
            })
        return generated

    # Fan out: one concurrent OpenRouter call per model
    payloads = await asyncio.gather(*(run_one(slug) for slug in body.models))
    generated = [item for group in payloads for item in group]

    return {
        "generated": generated,
        "added_count": sum(1 for g in generated if g["valid"]),
        "failed_count": sum(1 for g in generated if not g["valid"]),
    }


def _pretty_name(slug: str) -> str:
    for m in CURATED_MODELS:
        if m["slug"] == slug:
            return m["name"]
    vendor, _, model = slug.partition("/")
    return model.replace("-", " ").replace("_", " ").title() if model else slug
