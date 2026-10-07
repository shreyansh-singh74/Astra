"""
SQLite persistence layer for Astra.

Uses the stdlib sqlite3 module (no ORM) with a connection-per-operation
pattern, which is safe under FastAPI's threadpool. Code lives in the DB
as text so assignments/submissions/reports are fully portable.
"""
import json
import os
import sqlite3
from contextlib import contextmanager
from typing import Any, Dict, List, Optional

DB_PATH = os.environ.get(
    "ASTRA_DB_PATH",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "astra.db")),
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS assignments (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    problem_statement TEXT NOT NULL DEFAULT '',
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reference_solutions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    model_key     TEXT NOT NULL,
    model_name    TEXT NOT NULL,
    source        TEXT NOT NULL DEFAULT 'manual',   -- seed | manual | openrouter
    language      TEXT NOT NULL DEFAULT 'cpp',
    code          TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(assignment_id, model_key)
);

CREATE TABLE IF NOT EXISTS submissions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_name  TEXT NOT NULL DEFAULT '',
    filename      TEXT NOT NULL DEFAULT '',
    language      TEXT NOT NULL DEFAULT 'cpp',
    code          TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id  INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    assignment_id  INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    mode           TEXT NOT NULL DEFAULT 'single',  -- single | bulk
    verdict_json   TEXT NOT NULL,
    max_score      REAL NOT NULL DEFAULT 0.0,
    is_flagged     INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collusion_reports (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    threshold     REAL NOT NULL,
    matrix_json   TEXT NOT NULL,
    clusters_json TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with db() as conn:
        conn.executescript(SCHEMA)
        conn.execute("PRAGMA journal_mode = WAL")


# ── Settings ────────────────────────────────────────────────────────────

def get_setting(key: str, default: Optional[str] = None) -> Optional[str]:
    with db() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else default


def set_setting(key: str, value: str) -> None:
    with db() as conn:
        conn.execute(
            "INSERT INTO settings(key, value) VALUES(?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )


def all_settings() -> Dict[str, str]:
    with db() as conn:
        return {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM settings")}


# ── Assignments ─────────────────────────────────────────────────────────

def create_assignment(name: str, description: str = "", problem_statement: str = "") -> int:
    with db() as conn:
        cur = conn.execute(
            "INSERT INTO assignments(name, description, problem_statement) VALUES(?, ?, ?)",
            (name, description, problem_statement),
        )
        return int(cur.lastrowid)


def list_assignments() -> List[Dict[str, Any]]:
    with db() as conn:
        rows = conn.execute("SELECT * FROM assignments ORDER BY id").fetchall()
        return [dict(r) for r in rows]


def get_assignment(assignment_id: int) -> Optional[Dict[str, Any]]:
    with db() as conn:
        row = conn.execute("SELECT * FROM assignments WHERE id = ?", (assignment_id,)).fetchone()
        return dict(row) if row else None


def update_assignment(assignment_id: int, fields: Dict[str, Any]) -> bool:
    allowed = {"name", "description", "problem_statement"}
    updates = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if not updates:
        return False
    sets = ", ".join(f"{k} = ?" for k in updates)
    with db() as conn:
        cur = conn.execute(
            f"UPDATE assignments SET {sets} WHERE id = ?",
            (*updates.values(), assignment_id),
        )
        return cur.rowcount > 0


def delete_assignment(assignment_id: int) -> bool:
    with db() as conn:
        cur = conn.execute("DELETE FROM assignments WHERE id = ?", (assignment_id,))
        return cur.rowcount > 0


# ── Reference solutions (AI vault) ──────────────────────────────────────

def add_reference(
    assignment_id: int,
    model_key: str,
    model_name: str,
    code: str,
    source: str = "manual",
    language: str = "cpp",
) -> int:
    with db() as conn:
        cur = conn.execute(
            "INSERT INTO reference_solutions(assignment_id, model_key, model_name, source, language, code) "
            "VALUES(?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(assignment_id, model_key) DO UPDATE SET "
            "model_name = excluded.model_name, source = excluded.source, "
            "language = excluded.language, code = excluded.code",
            (assignment_id, model_key, model_name, source, language, code),
        )
        return int(cur.lastrowid)


def list_references(assignment_id: int) -> List[Dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            "SELECT id, assignment_id, model_key, model_name, source, language, code, created_at "
            "FROM reference_solutions WHERE assignment_id = ? ORDER BY id",
            (assignment_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def delete_reference(reference_id: int) -> bool:
    with db() as conn:
        cur = conn.execute("DELETE FROM reference_solutions WHERE id = ?", (reference_id,))
        return cur.rowcount > 0


# ── Submissions ─────────────────────────────────────────────────────────

def add_submission(
    assignment_id: int,
    code: str,
    student_name: str = "",
    filename: str = "",
    language: str = "cpp",
) -> int:
    with db() as conn:
        cur = conn.execute(
            "INSERT INTO submissions(assignment_id, student_name, filename, language, code) "
            "VALUES(?, ?, ?, ?, ?)",
            (assignment_id, student_name, filename, language, code),
        )
        return int(cur.lastrowid)


def list_submissions(assignment_id: int) -> List[Dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            "SELECT id, assignment_id, student_name, filename, language, created_at, "
            "LENGTH(code) AS code_size FROM submissions WHERE assignment_id = ? ORDER BY id",
            (assignment_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_submission(submission_id: int) -> Optional[Dict[str, Any]]:
    with db() as conn:
        row = conn.execute("SELECT * FROM submissions WHERE id = ?", (submission_id,)).fetchone()
        return dict(row) if row else None


def get_submissions_bulk(submission_ids: List[int]) -> List[Dict[str, Any]]:
    if not submission_ids:
        return []
    placeholders = ",".join("?" for _ in submission_ids)
    with db() as conn:
        rows = conn.execute(
            f"SELECT * FROM submissions WHERE id IN ({placeholders}) ORDER BY id",
            submission_ids,
        ).fetchall()
        return [dict(r) for r in rows]


def delete_submission(submission_id: int) -> bool:
    with db() as conn:
        cur = conn.execute("DELETE FROM submissions WHERE id = ?", (submission_id,))
        return cur.rowcount > 0


# ── Reports ─────────────────────────────────────────────────────────────

def save_report(
    submission_id: int,
    assignment_id: int,
    verdict: Dict[str, Any],
    max_score: float,
    is_flagged: bool,
    mode: str = "single",
) -> int:
    with db() as conn:
        cur = conn.execute(
            "INSERT INTO reports(submission_id, assignment_id, mode, verdict_json, max_score, is_flagged) "
            "VALUES(?, ?, ?, ?, ?, ?)",
            (submission_id, assignment_id, mode, json.dumps(verdict), max_score, int(is_flagged)),
        )
        return int(cur.lastrowid)


def get_report(report_id: int) -> Optional[Dict[str, Any]]:
    with db() as conn:
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
        if not row:
            return None
        report = dict(row)
        report["verdict"] = json.loads(report.pop("verdict_json"))
        return report


def list_reports(assignment_id: int) -> List[Dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            "SELECT r.id, r.submission_id, r.assignment_id, r.mode, r.max_score, r.is_flagged, "
            "r.created_at, s.student_name, s.filename "
            "FROM reports r JOIN submissions s ON s.id = r.submission_id "
            "WHERE r.assignment_id = ? ORDER BY r.id DESC",
            (assignment_id,),
        ).fetchall()
        return [dict(r) for r in rows]


# ── Collusion reports ───────────────────────────────────────────────────

def save_collusion_report(
    assignment_id: int, threshold: float, matrix: Dict[str, Any], clusters: List[Dict[str, Any]]
) -> int:
    with db() as conn:
        cur = conn.execute(
            "INSERT INTO collusion_reports(assignment_id, threshold, matrix_json, clusters_json) "
            "VALUES(?, ?, ?, ?)",
            (assignment_id, threshold, json.dumps(matrix), json.dumps(clusters)),
        )
        return int(cur.lastrowid)


def list_collusion_reports(assignment_id: int) -> List[Dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            "SELECT id, assignment_id, threshold, created_at FROM collusion_reports "
            "WHERE assignment_id = ? ORDER BY id DESC",
            (assignment_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_collusion_report(report_id: int) -> Optional[Dict[str, Any]]:
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM collusion_reports WHERE id = ?", (report_id,)
        ).fetchone()
        if not row:
            return None
        report = dict(row)
        report["matrix"] = json.loads(report.pop("matrix_json"))
        report["clusters"] = json.loads(report.pop("clusters_json"))
        return report
