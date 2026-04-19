"""SGN-BE-10 (Phase 43): CI grep guards.

Cross-cutting hazard #6/#7 enforcement:
- No `import sqlite3` anywhere in backend/app/
- No `import psycopg2` anywhere in backend/app/
- No sync `subprocess.run`/`subprocess.Popen`/`subprocess.call` in any
  signage module under backend/app/ (async code must use
  asyncio.subprocess_exec — Phase 44 will enforce this for PPTX).

Tests themselves may use subprocess — they live in backend/tests/, not
backend/app/, and the guards explicitly only scan backend/app/.
"""
import subprocess
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1] / "app"


def _grep_files(pattern: str, root: Path) -> list[str]:
    """Return list of file paths (one per matching file) via `grep -r -l`."""
    result = subprocess.run(
        ["grep", "-r", "--include=*.py", "-l", pattern, str(root)],
        capture_output=True,
        text=True,
    )
    return [line for line in result.stdout.splitlines() if line.strip()]


def test_no_sqlite3_import_in_backend_app():
    hits = _grep_files("^import sqlite3", APP_DIR)
    hits += _grep_files("^from sqlite3", APP_DIR)
    assert hits == [], f"sqlite3 import found in backend/app/: {hits}"


def test_no_psycopg2_import_in_backend_app():
    hits = _grep_files("^import psycopg2", APP_DIR)
    hits += _grep_files("^from psycopg2", APP_DIR)
    assert hits == [], f"psycopg2 import found in backend/app/: {hits}"


def _signage_modules() -> list[Path]:
    """Return every .py file under backend/app/ whose name or path contains 'signage'."""
    all_py = list(APP_DIR.rglob("*.py"))
    return [
        p
        for p in all_py
        if "signage" in p.name.lower() or "signage" in str(p).lower()
    ]


def test_no_sync_subprocess_in_signage_modules():
    offenders: list[tuple[str, str]] = []
    for path in _signage_modules():
        content = path.read_text()
        for bad in ("subprocess.run", "subprocess.Popen", "subprocess.call"):
            if bad in content:
                offenders.append((str(path), bad))
    assert offenders == [], (
        f"sync subprocess in signage module(s): {offenders} — "
        "use asyncio.subprocess_exec instead"
    )


def test_scanner_actually_finds_signage_files():
    """Sanity: the scanner covers a real set of files (non-vacuous)."""
    paths = _signage_modules()
    assert len(paths) >= 3, (
        f"expected >=3 signage modules under backend/app/, found {paths}"
    )


# ---------------------------------------------------------------------------
# Phase 44 — pin the new modules explicitly (defence in depth; the
# recursive scans above already cover signage_pptx.py via the "signage"
# substring, but directus_uploads.py does NOT match that and must be
# pinned by name).
# ---------------------------------------------------------------------------


def test_phase44_pptx_service_uses_async_subprocess_only():
    """signage_pptx.py must use asyncio.create_subprocess_exec for BOTH
    soffice and pdftoppm — no sync subprocess APIs anywhere (hazard #7)."""
    p = APP_DIR / "services" / "signage_pptx.py"
    assert p.exists(), f"Phase 44 module missing: {p}"
    content = p.read_text()
    # Hazard #7: no sync subprocess in signage services.
    for banned in (
        "subprocess.run",
        "subprocess.Popen",
        "subprocess.call",
        "subprocess.check_call",
        "subprocess.check_output",
    ):
        assert banned not in content, f"{banned} present in {p}"
    # Must use the async subprocess API and invoke BOTH required binaries.
    assert "asyncio.create_subprocess_exec" in content, (
        f"asyncio.create_subprocess_exec not found in {p}"
    )
    assert "soffice" in content, f"'soffice' not found in {p}"
    assert "pdftoppm" in content, f"'pdftoppm' not found in {p}"


def test_phase44_directus_uploads_no_sync_http():
    """directus_uploads.py must be async — httpx.AsyncClient, never the
    sync `requests` library (hazard #7 extended to HTTP clients)."""
    p = APP_DIR / "services" / "directus_uploads.py"
    assert p.exists(), f"Phase 44 module missing: {p}"
    content = p.read_text()
    # Async HTTP client required.
    assert ("import httpx" in content) or ("from httpx" in content), (
        f"httpx import not found in {p} — async HTTP client required"
    )
    for banned in ("import requests", "from requests"):
        assert banned not in content, f"{banned} present in {p}"
    # Also: no sync subprocess (belt-and-braces — this module shouldn't
    # shell out at all, but pin the ban anyway).
    for banned in ("subprocess.run", "subprocess.Popen", "subprocess.call"):
        assert banned not in content, f"{banned} present in {p}"
