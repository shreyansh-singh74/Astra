import pytest

from backend.app import db


@pytest.fixture()
def fresh_db(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "test.db"))
    db.init_db()
    yield db
    # each test gets an isolated database file


def test_settings_roundtrip(fresh_db):
    assert fresh_db.get_setting("missing", "dflt") == "dflt"
    fresh_db.set_setting("alpha", "1")
    fresh_db.set_setting("alpha", "2")  # upsert
    assert fresh_db.get_setting("alpha") == "2"


def test_assignment_crud(fresh_db):
    aid = fresh_db.create_assignment("HW1", "desc", "problem")
    assert fresh_db.get_assignment(aid)["name"] == "HW1"
    assert len(fresh_db.list_assignments()) == 1

    assert fresh_db.update_assignment(aid, {"name": "HW1b", "problem_statement": "p2"})
    assert fresh_db.get_assignment(aid)["name"] == "HW1b"

    assert fresh_db.delete_assignment(aid)
    assert fresh_db.get_assignment(aid) is None


def test_references_upsert_and_cascade(fresh_db):
    aid = fresh_db.create_assignment("HW1")
    fresh_db.add_reference(aid, "gpt4o", "GPT-4o", "code v1", source="seed")
    fresh_db.add_reference(aid, "gpt4o", "GPT-4o", "code v2", source="openrouter")
    refs = fresh_db.list_references(aid)
    assert len(refs) == 1  # upsert on (assignment_id, model_key)
    assert refs[0]["code"] == "code v2"

    # deleting the assignment cascades to references
    fresh_db.delete_assignment(aid)
    assert fresh_db.list_references(aid) == []


def test_submissions_and_reports(fresh_db):
    aid = fresh_db.create_assignment("HW1")
    sid = fresh_db.add_submission(aid, "int main(){}", "alice", "alice.cpp", "cpp")
    assert fresh_db.get_submission(sid)["student_name"] == "alice"
    assert len(fresh_db.list_submissions(aid)) == 1

    rid = fresh_db.save_report(sid, aid, {"results": {"gpt4o": {"final_score": 0.5}}}, 0.5, True)
    report = fresh_db.get_report(rid)
    assert report["verdict"]["results"]["gpt4o"]["final_score"] == 0.5
    assert report["is_flagged"] == 1
    assert len(fresh_db.list_reports(aid)) == 1


def test_collusion_report_roundtrip(fresh_db):
    aid = fresh_db.create_assignment("HW1")
    rid = fresh_db.save_collusion_report(
        aid, 0.7, {"students": [], "matrix": [[0, 1], [1, 0]]}, [{"members": ["a", "b"]}]
    )
    report = fresh_db.get_collusion_report(rid)
    assert report["matrix"]["matrix"] == [[0, 1], [1, 0]]
    assert report["clusters"] == [{"members": ["a", "b"]}]
