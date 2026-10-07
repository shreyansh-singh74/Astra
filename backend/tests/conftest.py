import os
import sys

import pytest

# Ensure the repo root (parent of backend/) is importable as `backend.*`
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))


@pytest.fixture
def anyio_backend():
    return "asyncio"
