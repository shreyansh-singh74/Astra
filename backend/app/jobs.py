"""
In-memory background job manager.

Bulk scans run CodeBERT over N submissions plus O(N²) pairwise comparisons,
which can far exceed an HTTP timeout — so bulk runs execute on a worker
thread and the frontend polls GET /api/jobs/{job_id} for progress.
"""
import threading
import time
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Dict, Optional

from backend.app.core.app_settings import get_weights

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="astra-job")
_jobs: Dict[str, Dict[str, Any]] = {}
_lock = threading.Lock()
_MAX_FINISHED_JOBS = 40


def submit_job(kind: str, runner: Callable[[Callable[[float], None]], Any]) -> str:
    """
    Queue `runner(progress_cb)` on the worker pool. The runner receives a
    callback taking a 0..1 progress fraction and must return a JSON-serializable
    result. Returns the job id immediately.
    """
    job_id = uuid.uuid4().hex
    with _lock:
        _jobs[job_id] = {
            "id": job_id,
            "kind": kind,
            "status": "queued",
            "progress": 0.0,
            "result": None,
            "error": None,
            "created_at": time.time(),
        }
        _prune_locked()

    def progress_cb(fraction: float) -> None:
        with _lock:
            job = _jobs.get(job_id)
            if job:
                job["progress"] = max(job["progress"], min(float(fraction), 1.0))

    def _run() -> None:
        with _lock:
            job = _jobs.get(job_id)
            if job:
                job["status"] = "running"
        try:
            result = runner(progress_cb)
            with _lock:
                job = _jobs.get(job_id)
                if job:
                    job["status"] = "done"
                    job["progress"] = 1.0
                    job["result"] = result
        except Exception as exc:  # surfaced to the poller, never swallowed
            traceback.print_exc()
            with _lock:
                job = _jobs.get(job_id)
                if job:
                    job["status"] = "failed"
                    job["error"] = f"{type(exc).__name__}: {exc}"

    _executor.submit(_run)
    return job_id


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    with _lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None


def _prune_locked() -> None:
    """Keep the newest N finished jobs so the dict cannot grow unbounded."""
    finished = [j for j in _jobs.values() if j["status"] in ("done", "failed")]
    finished.sort(key=lambda j: j["created_at"])
    for job in finished[: max(0, len(finished) - _MAX_FINISHED_JOBS)]:
        _jobs.pop(job["id"], None)


def default_weights() -> Dict[str, float]:
    return get_weights()
