"""PDF export via headless Chromium.

The deck's built output is printed with ``--print-to-pdf`` from the preview
server URL, so the deck's own ``@media print`` rules (page size, colours,
hidden slides) apply exactly as they would from the browser's print dialog.

Rendering can take longer than the gateway proxy allows for one request, so
exports run as background jobs: ``start_export`` returns a job id and
``job_status`` is polled until ``done`` or ``error``.
"""
from __future__ import annotations

import glob
import os
import re
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import Any

PDF_TIMEOUT_SEC = 180
_JOB_TTL_SEC = 900

_MAC_CANDIDATES = (
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
)
_LINUX_CANDIDATES = ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "microsoft-edge")


def find_browser() -> str | None:
    """Return a headless-capable Chromium binary, or None.

    Order: an explicit ``HTML_STUDIO_CHROME`` env var, Playwright's headless
    shell / Chromium cache (present when the user has Playwright), then the
    usual desktop installs.
    """
    env = os.environ.get("HTML_STUDIO_CHROME")
    if env and Path(env).is_file():
        return env
    # HOME may be redirected (sandboxes, test harnesses); also look at the account's
    # real home so a Playwright-installed headless shell is found either way.
    homes = {Path.home()}
    try:
        import pwd
        homes.add(Path(pwd.getpwuid(os.getuid()).pw_dir))
    except (ImportError, KeyError):
        pass
    cache_roots = [h / sub for h in homes for sub in (Path("Library/Caches/ms-playwright"), Path(".cache/ms-playwright"))]
    patterns = [
        "chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell",
        "chromium-*/chrome-*/Chromium.app/Contents/MacOS/Chromium",
        "chromium-*/chrome-linux/chrome",
    ]
    for root in cache_roots:
        for pat in patterns:
            hits = sorted(glob.glob(str(root / pat)), reverse=True)
            if hits:
                return hits[0]
    if sys.platform == "darwin":
        for c in _MAC_CANDIDATES:
            if Path(c).is_file():
                return c
    else:
        from shutil import which
        for c in _LINUX_CANDIDATES:
            hit = which(c)
            if hit:
                return hit
    return None


def render_pdf(browser: str, url: str, out_path: Path, *, timeout: int = PDF_TIMEOUT_SEC) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = out_path.with_suffix(".pdf.part")
    # A throwaway profile plus mock keychain / basic password store: without
    # them a fresh Chromium tries to create its "Safe Storage" key in the OS
    # keychain, which pops a system dialog and blocks the render until answered.
    with tempfile.TemporaryDirectory(prefix="html-studio-pdf-") as profile:
        cmd = [
            browser, "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
            f"--user-data-dir={profile}", "--use-mock-keychain", "--password-store=basic",
            "--no-first-run", "--no-default-browser-check", "--disable-extensions",
            "--run-all-compositor-stages-before-draw", "--virtual-time-budget=3000",
            "--no-pdf-header-footer", f"--print-to-pdf={tmp}", url,
        ]
        env = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "TMPDIR", "LANG", "LC_ALL")}
        # stderr to a file rather than a pipe: Chromium's helper processes can
        # keep a pipe open after the main process exits and stall the wait.
        with open(Path(profile) / "stderr.log", "w+", encoding="utf-8") as errf:
            proc = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=errf, timeout=timeout, env=env, check=False)
            errf.seek(0)
            stderr_text = errf.read()
    if not tmp.is_file() or tmp.stat().st_size == 0:
        err = stderr_text.strip().splitlines()
        # Chromium logs harmless noise on stderr; keep only the tail for diagnosis.
        raise RuntimeError("pdf render produced no file: " + " | ".join(err[-3:]) if err else "pdf render produced no file")
    os.replace(tmp, out_path)


def safe_pdf_name(deck_name: str) -> str:
    name = re.sub(r"[^\w.\- ]+", "_", deck_name, flags=re.UNICODE).strip() or "deck"
    return f"{name}.pdf"


class ExportJobs:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._jobs: dict[str, dict[str, Any]] = {}

    def start(self, browser: str, url: str, out_path: Path) -> str:
        job_id = uuid.uuid4().hex[:12]
        with self._lock:
            self._gc()
            self._jobs[job_id] = {"state": "running", "started": time.time(), "output": str(out_path)}
        threading.Thread(target=self._run, args=(job_id, browser, url, out_path), daemon=True).start()
        return job_id

    def _run(self, job_id: str, browser: str, url: str, out_path: Path) -> None:
        try:
            render_pdf(browser, url, out_path)
            result = {"state": "done", "output": str(out_path), "bytes": out_path.stat().st_size}
        except subprocess.TimeoutExpired:
            result = {"state": "error", "error": "pdf_timeout"}
        except Exception as exc:  # surfaced verbatim to the UI as detail
            result = {"state": "error", "error": "pdf_failed", "detail": str(exc)[:300]}
        with self._lock:
            self._jobs[job_id].update(result, finished=time.time())

    def status(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            rec = self._jobs.get(job_id)
            if rec is None:
                return None
            return {"id": job_id, **{k: v for k, v in rec.items() if k not in ("started", "finished")}}

    def _gc(self) -> None:
        now = time.time()
        for k in [k for k, v in self._jobs.items() if v.get("finished") and now - v["finished"] > _JOB_TTL_SEC]:
            self._jobs.pop(k, None)
