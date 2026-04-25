import json
import os
from pathlib import Path

from app.main import app

CONTRACT_PATH = Path(__file__).parent / "contracts" / "openapi_paths.json"


def test_openapi_paths_match_snapshot():
    """CLEAN-02 / D-07: lock the FastAPI surface.

    Asserts the sorted set of OpenAPI paths matches the committed baseline.
    Catches accidental re-registration of a deleted router (e.g. me_router,
    data_router) and accidental new-route additions that bypass the planning
    workflow.

    Regenerate with:
        UPDATE_SNAPSHOTS=1 pytest backend/tests/test_openapi_paths_snapshot.py
    """
    actual = sorted(app.openapi()["paths"].keys())
    if os.environ.get("UPDATE_SNAPSHOTS") == "1":
        CONTRACT_PATH.parent.mkdir(parents=True, exist_ok=True)
        CONTRACT_PATH.write_text(json.dumps(actual, indent=2) + "\n")
        return
    expected = json.loads(CONTRACT_PATH.read_text())
    assert actual == expected, (
        f"OpenAPI paths drift detected.\n"
        f"  added:   {sorted(set(actual) - set(expected))}\n"
        f"  removed: {sorted(set(expected) - set(actual))}\n"
        f"  Regenerate with UPDATE_SNAPSHOTS=1 if intentional."
    )
