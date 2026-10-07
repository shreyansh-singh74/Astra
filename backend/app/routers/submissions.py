import io
import zipfile
from typing import List

from fastapi import APIRouter, File, HTTPException, UploadFile

from backend.app import db
from backend.app.core.languages import LANGUAGES

router = APIRouter(prefix="/api", tags=["submissions"])

ACCEPTED_EXTENSIONS = tuple(
    ext for spec in LANGUAGES.values() for ext in spec.extensions
)


def _is_code_file(filename: str) -> bool:
    return filename.lower().endswith(ACCEPTED_EXTENSIONS)


def _student_name_from_filename(filename: str) -> str:
    stem = filename.rsplit(".", 1)[0] if "." in filename else filename
    if stem.lower().startswith("student_"):
        stem = stem[len("student_"):]
    return stem.replace("_", " ").replace("-", " ").strip()


async def _extract_files(upload: UploadFile) -> List[dict]:
    """
    Normalize one uploaded file into {filename, code, language} entries.
    A .zip archive is expanded into its contained code files.
    """
    filename = upload.filename or "upload"
    data = await upload.read()

    if filename.lower().endswith(".zip"):
        extracted = []
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            for info in archive.infolist():
                if info.is_dir():
                    continue
                base = info.filename.rsplit("/", 1)[-1]
                if not _is_code_file(base):
                    continue
                try:
                    code = archive.read(info).decode("utf-8", errors="ignore")
                except Exception:
                    continue
                if code.strip():
                    extracted.append({
                        "filename": base,
                        "code": code,
                        "language": _detect_language(base),
                    })
        if not extracted:
            raise HTTPException(
                status_code=422,
                detail=f"No code files found inside {filename} (supported: {', '.join(ACCEPTED_EXTENSIONS)}).",
            )
        return extracted

    if not _is_code_file(filename):
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type: {filename} (supported: {', '.join(ACCEPTED_EXTENSIONS)}, or .zip).",
        )
    code = data.decode("utf-8", errors="ignore")
    return [{"filename": filename, "code": code, "language": _detect_language(filename)}]


def _detect_language(filename: str) -> str:
    name = filename.lower()
    for key, spec in LANGUAGES.items():
        if name.endswith(spec.extensions):
            return key
    return "cpp"


@router.post("/assignments/{assignment_id}/submissions")
async def upload_submissions(assignment_id: int, files: List[UploadFile] = File(...)):
    if not db.get_assignment(assignment_id):
        raise HTTPException(status_code=404, detail="Assignment not found.")
    if not files:
        raise HTTPException(status_code=422, detail="No files uploaded.")

    created = []
    for upload in files:
        for entry in await _extract_files(upload):
            submission_id = db.add_submission(
                assignment_id=assignment_id,
                code=entry["code"],
                student_name=_student_name_from_filename(entry["filename"]),
                filename=entry["filename"],
                language=entry["language"],
            )
            created.append({"id": submission_id, **entry, "code_size": len(entry["code"])})

    return {"created": created, "count": len(created)}


@router.get("/assignments/{assignment_id}/submissions")
def list_submissions(assignment_id: int):
    if not db.get_assignment(assignment_id):
        raise HTTPException(status_code=404, detail="Assignment not found.")
    return db.list_submissions(assignment_id)


@router.get("/submissions/{submission_id}")
def get_submission(submission_id: int):
    submission = db.get_submission(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")
    return submission


@router.delete("/submissions/{submission_id}")
def delete_submission(submission_id: int):
    if not db.delete_submission(submission_id):
        raise HTTPException(status_code=404, detail="Submission not found.")
    return {"ok": True}
