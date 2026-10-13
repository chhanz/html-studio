"""Deck check: rule catalogue, the headless measurement run, and the job registry.

Rendered rules are measured by ``inject/check.js`` inside the preview server's
``/check`` document (every slide loaded in a same-origin iframe), run once per
deck in headless Chromium. The script posts each slide's issues back to the
preview server (``POST /check/result``) as the slide finishes; this module waits
on that sink in wall-clock time and reports slides it never heard from as
``check-error`` issues, so a stalled browser degrades the result instead of
losing it. The static rule (missing-cover) is evaluated here from the slide list.

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
    # Emitted by check.js when one slide could not be measured (hung load,
    # unreachable document); the rest of the deck is still reported.
    "check-error": "warning",
}

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


# stderr lines Chromium prints on macOS that carry no information about the
# check (the display link could not be created, e.g. while a display sleeps or
# is being re-plugged). Dropped from the detail shown to the user so the real
# cause, if any, is what they read.
_NOISE_RE = re.compile(r"CVDisplayLink|cv_display_link_mac|ui/display/mac")

# Per-slide settle budget inside check.js; the whole run gets this much per
# batch of 6 plus a floor, in wall-clock time.
SLIDE_TIMEOUT_MS = 20000
_BATCH = 6


def run_timeout(count: int) -> int:
    """Wall-clock budget for a deck of ``count`` slides: enough for every batch
    to hit the per-slide watchdog and still finish, never below the floor."""
    return max(CHECK_TIMEOUT_SEC, 30 + (count // _BATCH + 1) * (SLIDE_TIMEOUT_MS // 1000 + 5))


def _unmeasured(idx: int, detail: str) -> dict[str, Any]:
    return {"rule": "check-error", "slideIndex": idx, "selector": "", "tag": "", "classes": [], "text": "", "rect": None, "detail": detail}


def run_rendered(
    browser: str,
    check_url: str,
    sink: Any,
    count: int,
    *,
    timeout: int | None = None,
    slide_timeout_ms: int = SLIDE_TIMEOUT_MS,
) -> dict[str, Any]:
    """Run the /check document in headless Chromium; return ``{count, issues, unmeasured}``.

    ``sink`` is the preview's ``CheckSink``: check.js posts each slide's issues
    to it as the slide finishes, and this function waits (wall clock) until the
    run reports done, the browser exits, or ``timeout`` passes. Slides never
    heard from are reported as ``check-error`` issues rather than failing the
    run, so the user always gets the slides that were measured.
    """
    budget = timeout if timeout is not None else run_timeout(count)
    run_id = uuid.uuid4().hex[:12]
    url = f"{check_url}{'&' if '?' in check_url else '?'}run={run_id}&slideTimeout={int(slide_timeout_ms)}"
    sink.begin(run_id, count)
    stderr_text = ""
    exited_early = False
    try:
        with tempfile.TemporaryDirectory(prefix="html-studio-check-") as profile:
            cmd = [
                browser, "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
                f"--user-data-dir={profile}", "--use-mock-keychain", "--password-store=basic",
                "--no-first-run", "--no-default-browser-check", "--disable-extensions",
                # Best effort: do not drive frames from the macOS display link, which
                # fails while a display is asleep or being re-plugged (unknown feature
                # names are ignored by Chromium).
                "--disable-features=CVDisplayLinkBeginFrameSource",
                "--window-size=1400,900", url,
            ]
            env = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "TMPDIR", "LANG", "LC_ALL")}
            with open(Path(profile) / "stderr.log", "w+", encoding="utf-8") as errf:
                proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=errf, stdin=subprocess.DEVNULL, env=env)
                try:
                    deadline = time.monotonic() + budget
                    while True:
                        if sink.wait(run_id, timeout=min(1.0, max(0.0, deadline - time.monotonic()))):
                            break
                        if proc.poll() is not None:
                            # The browser is gone (crash, display change): give late posts a moment.
                            exited_early = True
                            sink.wait(run_id, timeout=1.0)
                            break
                        if time.monotonic() >= deadline:
                            break
                finally:
                    if proc.poll() is None:
                        proc.terminate()
                        try:
                            proc.wait(timeout=5)
                        except subprocess.TimeoutExpired:
                            proc.kill()
                            proc.wait(timeout=5)
                errf.seek(0)
                stderr_text = errf.read()
        snap = sink.snapshot(run_id) or {"slides": {}, "done": False}
    finally:
        sink.end(run_id)
    issues: list[dict[str, Any]] = []
    unmeasured: list[int] = []
    lines = [ln for ln in stderr_text.strip().splitlines() if ln.strip() and not _NOISE_RE.search(ln)]
    tail = lines[-1][:160] if lines else ""
    for idx in range(count):
        got = snap["slides"].get(idx)
        if got is None:
            unmeasured.append(idx)
            why = "browser exited before measuring this slide" if exited_early else f"check gave up after {budget}s before measuring this slide"
            issues.append(_unmeasured(idx, why + (f" ({tail})" if tail else "")))
        else:
            issues.extend(got)
    return {"count": count, "issues": issues, "unmeasured": unmeasured}


def finish(issues: list[dict[str, Any]], slides: list[str], disabled: set[str], unmeasured: list[int] | None = None) -> dict[str, Any]:
    """Attach severity and slide file, drop disabled rules, sort, summarise.

    ``unmeasured`` lists slides the rendered run never reported; the UI shows the
    result as partial and offers a re-run.
    """
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
    return {"issues": out, "counts": counts, "slides": len(slides), "rules": {r: s for r, s in RULES.items() if r not in disabled}, "disabled": sorted(disabled), "unmeasured": sorted(unmeasured or [])}


class CheckJobs:
    """Background jobs polled by id. ``kind`` prefixes the error codes
    (``check_timeout`` / ``build_failed``) so one class serves every long task."""

    def __init__(self, kind: str = "check") -> None:
        self.kind = kind
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
            result = {"state": "error", "error": f"{self.kind}_timeout"}
        except Exception as exc:  # surfaced verbatim to the UI as detail
            result = {"state": "error", "error": f"{self.kind}_failed", "detail": str(exc)[:300]}
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
