"""Deck check: rule catalogue, the headless measurement run, and the job registry.

Rendered rules are measured by ``inject/check.js`` inside the preview server's
``/check`` document (every slide loaded in a same-origin iframe), run once per
deck in headless Chromium with ``--dump-dom``; the script leaves its result in a
``<script id="hs-check-output">`` element that this module reads back. The
static rule (missing-cover) is evaluated here from the slide list.

Rules can be disabled per deck in ``studio.json``: ``{"check": {"disable": ["contrast"]}}``.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import Any

CHECK_TIMEOUT_SEC = 180
_JOB_TTL_SEC = 600

# rule id -> severity. Messages live in the UI's i18n (check.rule.<id>).
RULES: dict[str, str] = {
    "overflow": "error",
    "clipped": "error",
    "overlap": "error",
    "broken-image": "error",
    "missing-cover": "warning",
    "contrast": "warning",
    "punctuation": "warning",
    "external-resource": "warning",
    "inline-font-size": "info",
}

_RESULT_RE = re.compile(r'<script id="hs-check-output" type="application/json">(.*?)</script>', re.S)


def disabled_rules(studio: dict[str, Any] | None) -> set[str]:
    check = (studio or {}).get("check") or {}
    dis = check.get("disable") if isinstance(check, dict) else None
    return {str(r) for r in dis} if isinstance(dis, list) else set()


def static_issues(slides: list[str], first_slide_classes: list[str]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    if slides and "cover" not in first_slide_classes:
        issues.append(
            {"rule": "missing-cover", "slideIndex": 0, "selector": "", "tag": "section", "classes": first_slide_classes, "text": "", "rect": None, "detail": "first slide has no 'cover' class"}
        )
    return issues


def first_slide_classes(fragment: str) -> list[str]:
    m = re.search(r"""<section\b[^>]*\bclass=(["'])(.*?)\1""", fragment, re.I | re.S)
    return [c for c in (m.group(2).split() if m else []) if c != "active"]


def run_rendered(browser: str, check_url: str, *, timeout: int = CHECK_TIMEOUT_SEC) -> dict[str, Any]:
    """Run the /check document in headless Chromium and return its JSON result."""
    with tempfile.TemporaryDirectory(prefix="html-studio-check-") as profile:
        cmd = [
            browser, "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
            f"--user-data-dir={profile}", "--use-mock-keychain", "--password-store=basic",
            "--no-first-run", "--no-default-browser-check", "--disable-extensions",
            "--window-size=1400,900", "--run-all-compositor-stages-before-draw",
            f"--virtual-time-budget={timeout * 1000}", "--dump-dom", check_url,
        ]
        env = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "TMPDIR", "LANG", "LC_ALL")}
        with open(Path(profile) / "stderr.log", "w+", encoding="utf-8") as errf:
            proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=errf, timeout=timeout, env=env, check=False)
            errf.seek(0)
            stderr_text = errf.read()
    dom = proc.stdout.decode("utf-8", errors="replace")
    matches = _RESULT_RE.findall(dom)  # the inlined check.js mentions the marker in a comment; the real one is last
    if not matches:
        tail = " | ".join(stderr_text.strip().splitlines()[-3:])
        raise RuntimeError("check did not finish inside the browser" + (f": {tail}" if tail else ""))
    return json.loads(matches[-1])


def finish(issues: list[dict[str, Any]], slides: list[str], disabled: set[str]) -> dict[str, Any]:
    """Attach severity and slide file, drop disabled rules, sort, summarise."""
    out = []
    for it in issues:
        rule = str(it.get("rule", ""))
        if rule not in RULES or rule in disabled:
            continue
        idx = int(it.get("slideIndex", 0))
        out.append({**it, "severity": RULES[rule], "slideFile": slides[idx] if 0 <= idx < len(slides) else ""})
    order = {"error": 0, "warning": 1, "info": 2}
    out.sort(key=lambda i: (i["slideIndex"], order[i["severity"]], i["rule"]))
    counts: dict[str, int] = {}
    for it in out:
        counts[it["rule"]] = counts.get(it["rule"], 0) + 1
    return {"issues": out, "counts": counts, "slides": len(slides), "rules": {r: s for r, s in RULES.items() if r not in disabled}, "disabled": sorted(disabled)}


class CheckJobs:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._jobs: dict[str, dict[str, Any]] = {}

    def start(self, run: Any) -> str:
        """``run`` is a zero-arg callable returning the finished result dict."""
        job_id = uuid.uuid4().hex[:12]
        with self._lock:
            self._gc()
            self._jobs[job_id] = {"state": "running", "started": time.time()}
        threading.Thread(target=self._run, args=(job_id, run), daemon=True).start()
        return job_id

    def _run(self, job_id: str, run: Any) -> None:
        try:
            result = {"state": "done", "result": run()}
        except subprocess.TimeoutExpired:
            result = {"state": "error", "error": "check_timeout"}
        except Exception as exc:  # surfaced verbatim to the UI as detail
            result = {"state": "error", "error": "check_failed", "detail": str(exc)[:300]}
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
