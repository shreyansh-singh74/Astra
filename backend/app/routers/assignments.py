from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.app import db

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


class AssignmentCreate(BaseModel):
    name: str
    description: str = ""
    problem_statement: str = ""


class AssignmentUpdate(BaseModel):
    name: str = None  # type: ignore[assignment]
    description: str = None  # type: ignore[assignment]
    problem_statement: str = None  # type: ignore[assignment]


def _vault_summary(assignment_id: int) -> List[Dict[str, Any]]:
    return [
        {
            "id": r["id"],
            "model_key": r["model_key"],
            "model_name": r["model_name"],
            "source": r["source"],
            "language": r["language"],
            "code": r["code"],
        }
        for r in db.list_references(assignment_id)
    ]


@router.get("")
def list_assignments():
    out = []
    for a in db.list_assignments():
        out.append({
            **a,
            "vault": _vault_summary(a["id"]),
            "submission_count": len(db.list_submissions(a["id"])),
        })
    return out


@router.post("")
def create_assignment(body: AssignmentCreate):
    if not body.name.strip():
        raise HTTPException(status_code=422, detail="Assignment name is required.")
    assignment_id = db.create_assignment(
        name=body.name.strip(),
        description=body.description.strip(),
        problem_statement=body.problem_statement.strip() or body.description.strip(),
    )
    return {"id": assignment_id, **(db.get_assignment(assignment_id) or {})}


@router.get("/{assignment_id}")
def get_assignment(assignment_id: int):
    assignment = db.get_assignment(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    vault = db.list_references(assignment_id)
    return {
        **assignment,
        "vault": [
            {
                "id": r["id"],
                "model_key": r["model_key"],
                "model_name": r["model_name"],
                "source": r["source"],
                "language": r["language"],
                "code": r["code"],
                "created_at": r["created_at"],
            }
            for r in vault
        ],
        "submission_count": len(db.list_submissions(assignment_id)),
    }


@router.put("/{assignment_id}")
def update_assignment(assignment_id: int, body: AssignmentUpdate):
    if not db.get_assignment(assignment_id):
        raise HTTPException(status_code=404, detail="Assignment not found.")
    db.update_assignment(assignment_id, body.model_dump(exclude_none=True))
    return db.get_assignment(assignment_id)


@router.delete("/{assignment_id}")
def delete_assignment(assignment_id: int):
    if not db.delete_assignment(assignment_id):
        raise HTTPException(status_code=404, detail="Assignment not found.")
    return {"ok": True}
