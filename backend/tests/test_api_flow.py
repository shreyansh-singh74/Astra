"""
End-to-end API flow test against an isolated temp database.

Upload → bulk job (vault comparison + collusion) → polling → reports → CSV export.
Uses the real pipeline (tree-sitter tiers + CodeBERT), so it is slower than
unit tests but exercises the exact production path.
"""
import io
import time
import zipfile

import pytest
from fastapi.testclient import TestClient

from backend.app import db
from backend.app.main import app

BASE = """#include <vector>
#include <cmath>

bool checkRoute(std::vector<std::pair<int,int>>& path, std::vector<std::pair<int,int>>& chargers) {
    int energy = 100;
    for (int i = 0; i < (int)path.size() - 1; i++) {
        energy -= std::abs(path[i].first - path[i+1].first) + std::abs(path[i].second - path[i+1].second);
        if (energy <= 0) return false;
        for (const auto& pad : chargers) {
            if (pad.first == path[i+1].first && pad.second == path[i+1].second) {
                energy = 100;
                break;
            }
        }
    }
    return true;
}
"""

COPY = BASE.replace("checkRoute", "verifyTrack").replace("energy", "juice").replace("path", "coords").replace("chargers", "plugs")

INDEPENDENT = """#include <bits/stdc++.h>

int manhattan(std::pair<int,int> a, std::pair<int,int> b) {
    return std::abs(a.first-b.first) + std::abs(a.second-b.second);
}

bool feasible(std::vector<std::pair<int,int>> order, std::vector<std::pair<int,int>> stations) {
    std::set<std::pair<int,int>> charge(stations.begin(), stations.end());
    int budget = 100;
    for (size_t k = 1; k < order.size(); k++) {
        int d = manhattan(order[k-1], order[k]);
        if (d > budget) return false;
        budget -= d;
        if (charge.count(order[k])) budget = 100;
    }
    return true;
}
"""


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "flow.db"))
    with TestClient(app) as c:  # context manager runs the seeding lifespan
        yield c


def test_full_bulk_flow(client):
    # Seeded assignment with 4 vault references
    assignments = client.get("/api/assignments").json()
    assert len(assignments) == 1
    assignment_id = assignments[0]["id"]
    assert len(assignments[0]["vault"]) == 4

    # Upload individual files
    r = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files=[
            ("files", ("alice_hw.cpp", io.BytesIO(COPY.encode()), "text/plain")),
            ("files", ("bob_hw.cpp", io.BytesIO(BASE.encode()), "text/plain")),
        ],
    )
    assert r.status_code == 200, r.text
    assert r.json()["count"] == 2
    names = {s["student_name"] for s in client.get(f"/api/assignments/{assignment_id}/submissions").json()}
    assert names == {"alice hw", "bob hw"}

    # Upload a zip with the independent submission
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("carol_hw.cpp", INDEPENDENT)
        z.writestr("notes.txt", "ignored non-code file")
    buf.seek(0)
    r = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files=[("files", ("carol_bundle.zip", buf, "application/zip"))],
    )
    assert r.status_code == 200, r.text
    assert r.json()["count"] == 1  # .txt filtered out

    # Reject unsupported file types
    r = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files=[("files", ("rust.rs", io.BytesIO(b"fn main(){}"), "text/plain"))],
    )
    assert r.status_code == 422

    # Bulk analysis → background job
    r = client.post("/api/analyze/bulk", json={"assignment_id": assignment_id, "force": True})
    assert r.status_code == 200, r.text
    job_id = r.json()["job_id"]

    job = None
    for _ in range(120):  # up to 60s
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] in ("done", "failed"):
            break
        time.sleep(0.5)
    assert job and job["status"] == "done", job and job.get("error")
    result = job["result"]

    assert result["scanned"] == 3
    assert len(result["vault_verdicts"]) == 3
    # each verdict carries per-model tier scores for the vault
    some_verdict = next(iter(result["vault_verdicts"].values()))
    assert len(some_verdict["results"]) == 4
    assert {"token_score", "ast_score", "cfg_score", "semantic_score", "final_score"} <= set(
        next(iter(some_verdict["results"].values()))
    )

    # alice (copy of bob's code) clusters with bob; carol stays clean
    clusters = result["collusion"]["clusters"]
    assert clusters, "expected at least one collusion cluster"
    clustered_members = {m for c in clusters for m in c["members"]}
    assert {"alice hw", "bob hw"} <= clustered_members
    assert "carol hw" not in clustered_members

    # Reports persisted and retrievable
    reports = client.get(f"/api/assignments/{assignment_id}/reports").json()
    assert len(reports) == 3
    report_id = reports[0]["id"]
    detail = client.get(f"/api/reports/{report_id}").json()
    assert "verdict" in detail

    # CSV exports
    csv_resp = client.get(f"/api/reports/{report_id}/export")
    assert csv_resp.status_code == 200
    assert "model_key" in csv_resp.text

    collusion_id = result["collusion_report_id"]
    csv_resp = client.get(f"/api/collusion/{collusion_id}/export")
    assert csv_resp.status_code == 200
    assert "alice hw" in csv_resp.text

    # stored collusion report round-trips
    stored = client.get(f"/api/collusion/{collusion_id}").json()
    assert stored["matrix"]["students"]
    assert any("alice hw" in c["members"] for c in stored["clusters"])


def test_single_analysis_and_legacy_compare(client):
    assignments = client.get("/api/assignments").json()
    assignment_id = assignments[0]["id"]

    r = client.post(
        f"/api/assignments/{assignment_id}/submissions",
        files=[("files", ("alice_hw.cpp", io.BytesIO(COPY.encode()), "text/plain"))],
    )
    submission_id = r.json()["created"][0]["id"]

    r = client.post("/api/analyze/single", json={"submission_id": submission_id, "force": True})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["submission"]["student_name"] == "alice hw"
    assert len(body["results"]) == 4
    assert body["report_id"] > 0

    # legacy raw-text endpoint still works
    r = client.post("/api/compare", json={"student_code": COPY, "force": True})
    assert r.status_code == 200
    assert "is_flagged" in r.json()


def test_settings_update_and_validation(client):
    r = client.get("/api/settings").json()
    assert r["weights"]["semantic"] == 0.4

    r = client.put("/api/settings", json={
        "weights": {"token": 0.1, "ast": 0.1, "cfg": 0.1, "semantic": 0.7},
        "sieve_threshold": 0.15,
        "collusion_threshold": 0.6,
    })
    assert r.status_code == 200
    assert r.json()["weights"]["semantic"] == 0.7
    assert r.json()["sieve_threshold"] == 0.15

    # all-zero weights are rejected as zero-sum
    r = client.put("/api/settings", json={
        "weights": {"token": 0, "ast": 0, "cfg": 0, "semantic": 0}
    })
    assert r.status_code == 422


def test_openrouter_endpoints_without_key(client):
    assert client.get("/api/openrouter/status").json() == {"has_key": False}

    r = client.post("/api/openrouter/key", json={"api_key": ""})
    assert r.status_code == 422

    r = client.post(f"/api/openrouter/assignments/1/vault/generate",
                    json={"models": ["openai/gpt-4o"]})
    assert r.status_code == 400
    assert "API key" in r.json()["detail"]

    models = client.get("/api/openrouter/models").json()
    assert len(models["curated"]) >= 5


def test_assignment_crud(client):
    r = client.post("/api/assignments", json={
        "name": "HW2 — Dijkstra",
        "description": "Shortest paths",
        "problem_statement": "Implement Dijkstra on a weighted graph.",
    })
    assert r.status_code == 200
    new_id = r.json()["id"]

    # add a manual reference
    r = client.post(f"/api/assignments/{new_id}/vault", json={
        "model_name": "TA Reference",
        "code": "int main() { return 0; }",
        "language": "cpp",
    })
    assert r.status_code == 200

    detail = client.get(f"/api/assignments/{new_id}").json()
    assert len(detail["vault"]) == 1
    assert detail["vault"][0]["source"] == "manual"

    r = client.put(f"/api/assignments/{new_id}", json={"name": "HW2 — Graphs"})
    assert r.json()["name"] == "HW2 — Graphs"

    assert client.delete(f"/api/assignments/{new_id}").status_code == 200
    assert client.get(f"/api/assignments/{new_id}").status_code == 404
