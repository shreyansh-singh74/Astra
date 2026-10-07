"""
One-time migration of the legacy filesystem layout into SQLite.

Runs at startup when the assignments table is empty. Imports
storage/assignments/assignment_1/ai_vault/*.cpp as seeded reference
solutions so the original demo data keeps working.
"""
import os

from backend.app import db

STORAGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage"))
LEGACY_ASSIGNMENT_DIR = os.path.join(STORAGE_DIR, "assignments", "assignment_1")
LEGACY_VAULT_DIR = os.path.join(LEGACY_ASSIGNMENT_DIR, "ai_vault")

LEGACY_DESCRIPTION = (
    "A robotic cargo cart must visit a sequence of grid coordinates (x, y) in a strict order. "
    "Moving between two grid points consumes battery equal to the Manhattan Distance between them. "
    "Landing exactly on a Charging Station refills the battery to 100 units. "
    "Write a C++ function to determine if the cart can safely finish its route without battery "
    "hitting <= 0."
)

MODEL_DISPLAY = {
    "gpt4o": "GPT-4o",
    "claude35": "Claude 3.5",
    "gemini15": "Gemini 1.5",
    "deepseek": "DeepSeek",
}


def seed_if_empty() -> None:
    db.init_db()
    if db.list_assignments():
        return

    assignment_id = db.create_assignment(
        name="The Autonomous Cargo Cart",
        description=LEGACY_DESCRIPTION,
        problem_statement=LEGACY_DESCRIPTION,
    )

    if os.path.isdir(LEGACY_VAULT_DIR):
        for filename in sorted(os.listdir(LEGACY_VAULT_DIR)):
            if not filename.endswith(".cpp"):
                continue
            model_key = filename.replace("reference_", "").replace(".cpp", "")
            with open(os.path.join(LEGACY_VAULT_DIR, filename), "r") as f:
                code = f.read()
            db.add_reference(
                assignment_id=assignment_id,
                model_key=model_key,
                model_name=MODEL_DISPLAY.get(model_key, model_key.upper()),
                code=code,
                source="seed",
                language="cpp",
            )
