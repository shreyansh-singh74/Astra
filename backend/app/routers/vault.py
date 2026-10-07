import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.app import db
from backend.app.core import app_settings
from backend.app.core.openrouter_client import CURATED_MODELS, generate_solution

router = APIRouter(tags=["vault"])


class ReferenceCreate(BaseModel):
    model_name: str
    code: str
    language: str = "cpp"


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", name.strip()).strip("_").lower()
    return slug or "reference"


@router.post("/api/assignments/{assignment_id}/vault")
def add_reference(assignment_id: int, body: ReferenceCreate):
    if not db.get_assignment(assignment_id):
        raise HTTPException(status_code=404, detail="Assignment not found.")
    if not body.code.strip():
        raise HTTPException(status_code=422, detail="Reference code is required.")
    model_name = body.model_name.strip() or "Manual reference"
    reference_id = db.add_reference(
        assignment_id=assignment_id,
        model_key=_slugify(model_name),
        model_name=model_name,
        code=body.code,
        source="manual",
        language=body.language,
    )
    return {"id": reference_id, "model_key": _slugify(model_name), "model_name": model_name}


@router.delete("/api/vault/{reference_id}")
def delete_reference(reference_id: int):
    if not db.delete_reference(reference_id):
        raise HTTPException(status_code=404, detail="Reference not found.")
    return {"ok": True}


class VaultGenerateRequest(BaseModel):
    models: list[str]
    language: str = "cpp"
    problem_statement: str | None = None
    variants_per_model: int = 1


@router.post("/api/assignments/{assignment_id}/vault/generate")
async def generate_references_alias(assignment_id: int, body: VaultGenerateRequest):
    """Plan-spec alias of POST /api/openrouter/assignments/{id}/vault/generate."""
    from backend.app.routers.openrouter import generate_references, GenerateRequest

    return await generate_references(
        assignment_id,
        GenerateRequest(
            models=body.models,
            language=body.language,
            problem_statement=body.problem_statement,
            variants_per_model=body.variants_per_model,
        ),
    )
