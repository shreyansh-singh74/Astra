"""
Collusion engine tests with CodeBERT monkeypatched (deterministic fake embeddings,
so no model download / GPU work happens here).
"""
import numpy as np
import pytest

from backend.app.core import collusion
from backend.app.core.engine import DEFAULT_WEIGHTS


BASE = """
#include <vector>
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

RENAMED_COPY = """
#include <vector>
#include <cmath>

bool verifyTrack(std::vector<std::pair<int,int>>& coords, std::vector<std::pair<int,int>>& plugs) {
    int juice = 100;
    for (size_t idx = 0; idx + 1 < coords.size(); idx++) {
        juice -= std::abs(coords[idx].first - coords[idx+1].first) + std::abs(coords[idx].second - coords[idx+1].second);
        if (juice <= 0) return false;
        for (const auto& station : plugs) {
            if (station.first == coords[idx+1].first && station.second == coords[idx+1].second) {
                juice = 100;
                break;
            }
        }
    }
    return true;
}
"""

INDEPENDENT = """
#include <bits/stdc++.h>

int manhattan(std::pair<int,int> a, std::pair<int,int> b) {
    return std::abs(a.first-b.first) + std::abs(a.second-b.second);
}

struct Segment { int x1, y1, x2, y2, cost; };

bool feasible(std::vector<std::pair<int,int>> order, std::vector<std::pair<int,int>> stations) {
    // segment-based sweep with a charge cursor instead of a simulation loop
    std::set<std::pair<int,int>> charge(stations.begin(), stations.end());
    std::vector<Segment> segs;
    for (size_t k = 1; k < order.size(); k++) {
        int d = manhattan(order[k-1], order[k]);
        segs.push_back({order[k-1].first, order[k-1].second, order[k].first, order[k].second, d});
    }
    int cursor = 0;
    int budget = 100;
    while (cursor < (int)segs.size()) {
        if (segs[cursor].cost > budget) return false;
        budget -= segs[cursor].cost;
        if (charge.count({segs[cursor].x2, segs[cursor].y2})) budget = 100;
        cursor++;
    }
    return true;
}
"""


@pytest.fixture(autouse=True)
def fake_embeddings(monkeypatch):
    """
    Deterministic CodeBERT stand-in. It must model the real model's key
    invariance — robustness to identifier renaming — so the fake embeds the
    AST-NORMALIZED code (custom names already rewritten to var_N/func_N),
    not the raw source. Similarity is then a char 3-gram profile cosine:
    renamed copies stay close, genuinely different solutions do not.
    """
    from backend.app.core.ast_normalizer import normalize_ast

    def fake_get_embedding(code, *args, **kwargs):
        normalized, _ = normalize_ast(code)
        vec = np.zeros(64)
        scrubbed = "".join(normalized.split())
        for i in range(len(scrubbed) - 2):
            vec[hash(scrubbed[i:i+3]) % 64] += 1.0
        norm = np.linalg.norm(vec)
        return vec / norm if norm > 0 else vec

    monkeypatch.setattr(collusion, "get_embedding", fake_get_embedding)


def _sub(idx, code):
    return {"id": idx, "student_name": f"student{idx}", "filename": f"s{idx}.cpp",
            "language": "cpp", "code": code}


def test_identical_pair_flagged_and_clustered():
    subs = [_sub(1, BASE), _sub(2, BASE.replace("energy", "power"))]
    result = collusion.run_collusion_analysis(subs, threshold=0.55)
    assert len(result["pairs"]) == 1
    assert result["pairs"][0]["final_score"] >= 0.55
    assert len(result["clusters"]) == 1
    assert set(result["clusters"][0]["members"]) == {"student1", "student2"}


def test_renamed_copy_clusters_with_source():
    subs = [_sub(1, BASE), _sub(2, RENAMED_COPY), _sub(3, INDEPENDENT)]
    result = collusion.run_collusion_analysis(subs, threshold=0.55)
    clusters = result["clusters"]
    assert len(clusters) == 1
    assert set(clusters[0]["members"]) == {"student1", "student2"}
    # independent student is in no cluster
    all_clustered = {m for c in clusters for m in c["members"]}
    assert "student3" not in all_clustered


def test_independent_solutions_not_flagged():
    subs = [_sub(1, INDEPENDENT), _sub(2, BASE)]
    result = collusion.run_collusion_analysis(subs, threshold=0.55)
    assert result["pairs"] == []
    assert result["clusters"] == []


def test_matrix_symmetric_with_diagonal_zero():
    subs = [_sub(1, BASE), _sub(2, RENAMED_COPY), _sub(3, INDEPENDENT)]
    result = collusion.run_collusion_analysis(subs, threshold=0.55)
    m = result["matrix"]
    n = len(subs)
    assert len(m) == n and all(len(row) == n for row in m)
    for i in range(n):
        assert m[i][i] == 0.0
        for j in range(n):
            assert m[i][j] == m[j][i]


def test_single_submission_short_circuits():
    result = collusion.run_collusion_analysis([_sub(1, BASE)], threshold=0.55)
    assert result["pairs"] == [] and result["clusters"] == []
    assert len(result["students"]) == 1


def test_progress_callback_reaches_one():
    seen = []
    subs = [_sub(1, BASE), _sub(2, RENAMED_COPY)]
    collusion.run_collusion_analysis(subs, threshold=0.9, progress_cb=seen.append)
    assert seen and abs(seen[-1] - 1.0) < 1e-9
    assert seen == sorted(seen)  # monotonic


def test_weights_override_changes_score():
    subs = [_sub(1, BASE), _sub(2, RENAMED_COPY)]
    default = collusion.run_collusion_analysis(subs, threshold=0.0)
    semantic_only = collusion.run_collusion_analysis(
        subs, threshold=0.0, weights={"token": 0.0, "ast": 0.0, "cfg": 0.0, "semantic": 1.0}
    )
    assert default["pairs"][0]["final_score"] != semantic_only["pairs"][0]["final_score"]
