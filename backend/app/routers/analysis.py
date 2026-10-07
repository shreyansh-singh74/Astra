import csv
import io
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.app import db, jobs
from backend.app.core import app_settings
from backend.app.core.scan import compare_against_vault
from backend.app.core.collusion import run_collusion_analysis

router = APIRouter(prefix="/api", tags=["analysis"])


class AnalyzeSingleRequest(BaseModel):
    submission_id: int
    force: Optional[bool] = None
    sieve_threshold: Optional[float] = None


class AnalyzeBulkRequest(BaseModel):
    assignment_id: int
    submission_ids: Optional[List[int]] = None
    force: Optional[bool] = None
    sieve_threshold: Optional[float] = None
    collusion_threshold: Optional[float] = None


class LegacyCompareRequest(BaseModel):
    student_code: str
    assignment_id: str = "assignment_1"
    sieve_threshold: float = 0.10
    force: bool = False
    language: str = "cpp"


@router.post("/analyze/single")
def analyze_single(body: AnalyzeSingleRequest):
    submission = db.get_submission(body.submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")

    references = db.list_references(submission["assignment_id"])
    sieve = body.sieve_threshold if body.sieve_threshold is not None else app_settings.get_sieve_threshold()

    verdict = compare_against_vault(
        student_code=submission["code"],
        language=submission["language"],
        references=references,
        force=bool(body.force),
        sieve_threshold=sieve,
        weights=app_settings.get_weights(),
    )

    max_score = max(
        (r.get("final_score", 0.0) for r in verdict["results"].values()), default=0.0
    )
    report_id = db.save_report(
        submission_id=submission["id"],
        assignment_id=submission["assignment_id"],
        verdict=verdict,
        max_score=max_score,
        is_flagged=verdict["is_flagged"],
        mode="single",
    )
    return {
        "report_id": report_id,
        "submission": {
            "id": submission["id"],
            "student_name": submission["student_name"],
            "filename": submission["filename"],
            "language": submission["language"],
        },
        **verdict,
    }


@router.post("/analyze/bulk")
def analyze_bulk(body: AnalyzeBulkRequest):
    assignment = db.get_assignment(body.assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    if body.submission_ids:
        submissions = db.get_submissions_bulk(body.submission_ids)
        found_ids = {s["id"] for s in submissions}
        missing = set(body.submission_ids) - found_ids
        if missing:
            raise HTTPException(status_code=404, detail=f"Submissions not found: {sorted(missing)}")
    else:
        submissions = db.list_submissions(body.assignment_id)
        submissions = [
            {**s, "code": db.get_submission(s["id"])["code"]}
            for s in submissions
        ]
    if len(submissions) < 1:
        raise HTTPException(status_code=422, detail="No submissions to analyze. Upload files first.")

    references = db.list_references(body.assignment_id)
    force = bool(body.force)
    sieve = body.sieve_threshold if body.sieve_threshold is not None else app_settings.get_sieve_threshold()
    collusion_threshold = (
        body.collusion_threshold if body.collusion_threshold is not None
        else app_settings.get_collusion_threshold()
    )
    weights = app_settings.get_weights()

    def runner(progress_cb) -> Dict[str, Any]:
        vault_verdicts: Dict[str, Any] = {}

        for idx, sub in enumerate(submissions):
            verdict = compare_against_vault(
                student_code=sub["code"],
                language=sub["language"],
                references=references,
                force=force,
                sieve_threshold=sieve,
                weights=weights,
            )
            max_score = max(
                (r.get("final_score", 0.0) for r in verdict["results"].values()), default=0.0
            )
            report_id = db.save_report(
                submission_id=sub["id"],
                assignment_id=body.assignment_id,
                verdict=_strip_heavy_payloads(verdict),
                max_score=max_score,
                is_flagged=verdict["is_flagged"],
                mode="bulk",
            )
            vault_verdicts[str(sub["id"])] = {
                "report_id": report_id,
                "submission_id": sub["id"],
                "student_name": sub["student_name"],
                "filename": sub["filename"],
                "language": sub["language"],
                "is_flagged": verdict["is_flagged"],
                "flagged_reasons": verdict["flagged_reasons"],
                "max_score": round(max_score, 4),
                "results": {
                    key: {k: round(v, 4) if isinstance(v, float) else v for k, v in res.items()
                          if k in ("token_score", "ast_score", "cfg_score", "semantic_score",
                                   "final_score", "flag", "status", "diagnostics")}
                    for key, res in verdict["results"].items()
                },
            }
            progress_cb(0.05 + 0.45 * (idx + 1) / len(submissions))

        collusion = run_collusion_analysis(
            submissions=submissions,
            threshold=collusion_threshold,
            weights=weights,
            progress_cb=lambda f: progress_cb(0.5 + 0.45 * f),
        )
        collusion_report_id = db.save_collusion_report(
            assignment_id=body.assignment_id,
            threshold=collusion_threshold,
            matrix={"students": collusion["students"], "matrix": collusion["matrix"]},
            clusters=collusion["clusters"],
        )

        flagged_count = sum(1 for v in vault_verdicts.values() if v["is_flagged"])
        return {
            "assignment_id": body.assignment_id,
            "assignment_name": assignment["name"],
            "scanned": len(submissions),
            "flagged_count": flagged_count,
            "vault_verdicts": vault_verdicts,
            "collusion": collusion,
            "collusion_report_id": collusion_report_id,
        }

    job_id = jobs.submit_job("bulk_analysis", runner)
    return {"job_id": job_id}


def _strip_heavy_payloads(verdict: Dict[str, Any]) -> Dict[str, Any]:
    """Persist compact verdicts: drop AST dumps and CFG graphs (recomputed on drill-down)."""
    compact = {**verdict, "results": {}}
    for key, res in verdict["results"].items():
        compact["results"][key] = {
            k: v for k, v in res.items()
            if k not in ("student_ast_code", "ref_ast_code", "student_cfg", "ref_cfg")
        }
    return compact


@router.get("/jobs/{job_id}")
def get_job(job_id: str):
    job = jobs.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


@router.get("/reports/{report_id}")
def get_report(report_id: int):
    report = db.get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    return report


@router.get("/assignments/{assignment_id}/reports")
def list_reports(assignment_id: int):
    return db.list_reports(assignment_id)


@router.get("/collusion/{collusion_report_id}")
def get_collusion_report(collusion_report_id: int):
    report = db.get_collusion_report(collusion_report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Collusion report not found.")
    return report


@router.get("/assignments/{assignment_id}/collusion")
def list_collusion_reports(assignment_id: int):
    return db.list_collusion_reports(assignment_id)


@router.get("/reports/{report_id}/export")
def export_report_csv(report_id: int):
    report = db.get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    submission = db.get_submission(report["submission_id"]) or {}
    verdict = report.get("verdict", {})

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["model_key", "token_score", "ast_score", "cfg_score",
                     "semantic_score", "final_score", "flag"])
    for model_key, res in verdict.get("results", {}).items():
        writer.writerow([
            model_key,
            f"{res.get('token_score', 0):.4f}",
            f"{res.get('ast_score', 0):.4f}",
            f"{res.get('cfg_score', 0):.4f}",
            f"{res.get('semantic_score', 0):.4f}",
            f"{res.get('final_score', 0):.4f}",
            res.get("flag") or "",
        ])
    buffer.seek(0)
    filename = f"astra_report_{report_id}_{submission.get('filename', 'submission')}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/collusion/{collusion_report_id}/export")
def export_collusion_csv(collusion_report_id: int):
    report = db.get_collusion_report(collusion_report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Collusion report not found.")

    students = report["matrix"]["students"]
    matrix = report["matrix"]["matrix"]
    names = [
        s.get("student_name") or s.get("filename") or f"submission-{s['id']}"
        for s in students
    ]

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([""] + names)
    for name, row in zip(names, matrix):
        writer.writerow([name] + [f"{v:.4f}" for v in row])
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="astra_collusion_{collusion_report_id}.csv"'},
    )


# ── Legacy endpoint kept for backwards compatibility ────────────────────
@router.post("/compare")
def legacy_compare(body: LegacyCompareRequest):
    """Raw-text quick scan against the first assignment's vault."""
    assignments = db.list_assignments()
    if not assignments:
        raise HTTPException(status_code=500, detail="No assignments configured on the backend.")
    assignment = assignments[0]
    try:
        assignment_id = int(body.assignment_id)
        found = db.get_assignment(assignment_id)
        if found:
            assignment = found
    except (ValueError, TypeError):
        pass
    references = db.list_references(assignment["id"])

    verdict = compare_against_vault(
        student_code=body.student_code,
        language=body.language or "cpp",
        references=references,
        force=body.force,
        sieve_threshold=body.sieve_threshold,
        weights=app_settings.get_weights(),
    )
    return {"assignment_id": assignment["id"], **verdict}
