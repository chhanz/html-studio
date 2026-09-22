"""HTML Studio backend.

A small stdlib-only HTTP server managed by Kiro Crew. The dashboard never
talks to this process directly: every request is forwarded by the gateway
through ``/apps/html-studio/api/*`` and signed with the per-app proxy secret.
We verify that signature on every route except ``/health``, which the gateway
probes unsigned.

Environment injected by Kiro Crew at spawn time:
  PORT                    port to bind on 127.0.0.1
  KIROCREW_APP_NAME       app name (html-studio)
  KIROCREW_HOME           Kiro Crew config dir (~/.kiro/crew)
  KIROCREW_PROXY_SECRET   HMAC key shared with the gateway
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import subprocess
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))
import decks as deck_lib  # noqa: E402
import preview as preview_lib  # noqa: E402
import build as build_lib  # noqa: E402
import export as export_lib  # noqa: E402

PDF_JOBS = export_lib.ExportJobs()

PREVIEWS = preview_lib.PreviewRegistry()

APP_NAME = os.environ.get("KIROCREW_APP_NAME", "html-studio")
APP_VERSION = "0.1.8"
PORT = int(os.environ.get("PORT", "9100"))
HOME = Path(os.environ.get("KIROCREW_HOME", str(Path.home() / ".kiro" / "crew")))
DATA_DIR = HOME / "apps" / APP_NAME / "data"

_PROXY_HEADER = "X-KiroCrew-Proxy"
_MAX_SKEW_SECONDS = 60
_PICK_FOLDER_TIMEOUT = 120
# The chooser must be hosted by a foreground process or it opens BEHIND the
# app window. Self-"activate" costs ~2s; activating System Events costs ~0.3s.
_PICK_FOLDER_PROMPT = "Choose a folder that contains slide decks"


def _pick_folder_script(start_dir: str | None) -> str:
    # `choose folder` runs OUTSIDE the tell block on purpose: inside it the
    # command is sent to System Events as an Apple event, which a sandboxed
    # backend may not be allowed to do; outside, osascript handles it itself.
    where = f' default location (POSIX file "{start_dir}")' if start_dir else ""
    return "\n".join(
        [
            'tell application "System Events" to activate',
            "try",
            f'  set chosen to choose folder with prompt "{_PICK_FOLDER_PROMPT}"{where}',
            "  return POSIX path of chosen",
            "on error number -128",
            '  return ""',
            "end try",
        ]
    )


def _log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", file=sys.stderr, flush=True)


# --------------------------------------------------------------------------- auth
def verify_proxy_signature(header_value: str, *, method: str, target: str, body: bytes) -> bool:
    """Return True iff the gateway signature is present, fresh and valid.

    Signature format: ``<ts>:<hmac_sha256(secret, "<ts>:<METHOD>:<target>:<sha256(body)>")>``
    where ``target`` is the raw request-target as received (path + query).
    Fails closed on any missing or malformed input.
    """
    secret = os.environ.get("KIROCREW_PROXY_SECRET", "")
    if not secret or not header_value or ":" not in header_value:
        return False
    ts_str, _, sig = header_value.partition(":")
    if not ts_str.isdigit() or not sig:
        return False
    if abs(time.time() - int(ts_str)) > _MAX_SKEW_SECONDS:
        return False
    body_hash = hashlib.sha256(body or b"").hexdigest()
    msg = f"{ts_str}:{method}:{target}:{body_hash}"
    expected = hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)


# ------------------------------------------------------------------------- routes
Route = Callable[["Handler", dict[str, Any]], tuple[int, Any]]


def route_health(_h: "Handler", _body: dict[str, Any]) -> tuple[int, Any]:
    return 200, {"status": "ok", "app": APP_NAME, "version": APP_VERSION, "routes": len(ROUTES)}


def route_status(_h: "Handler", _body: dict[str, Any]) -> tuple[int, Any]:
    return 200, {
        "app": APP_NAME,
        "version": APP_VERSION,
        "python": sys.version.split()[0],
        "dataDir": str(DATA_DIR),
        "pickerSupported": _picker_supported(),
    }


def _picker_supported() -> bool:
    return sys.platform == "darwin" and not os.environ.get("HTML_STUDIO_NO_PICKER")


def _pick_folder() -> str | None:
    """Open the OS folder chooser; return the chosen path or None when cancelled.

    Starts in the parent of the most recently added root so repeat additions
    need fewer clicks. Quotes in the path are rejected rather than escaped.
    """
    start: str | None = None
    roots = deck_lib.list_roots(DATA_DIR)
    if roots:
        parent = Path(roots[-1]).parent
        if parent.is_dir() and '"' not in str(parent):
            start = str(parent)
    proc = subprocess.run(
        ["/usr/bin/osascript", "-e", _pick_folder_script(start)],
        capture_output=True, text=True, timeout=_PICK_FOLDER_TIMEOUT, check=False,
    )
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "").strip().replace("\n", " ")[:300]
        _log(f"folder chooser failed rc={proc.returncode}: {detail}")
        raise RuntimeError(f"osascript exited {proc.returncode}: {detail or 'no output'}")
    path = proc.stdout.strip().rstrip("/")
    return path or None


def route_roots(_h: "Handler", _body: dict[str, Any]) -> tuple[int, Any]:
    return 200, {"roots": deck_lib.list_roots(DATA_DIR), "pickerSupported": _picker_supported()}


def route_roots_add(_h: "Handler", body: dict[str, Any]) -> tuple[int, Any]:
    """Add a root by path. Without a path, callers must use the async picker (/roots/pick)."""
    raw = body.get("path")
    if not isinstance(raw, str) or not raw.strip():
        return 400, {"error": "path_required"}
    try:
        roots = deck_lib.add_root(DATA_DIR, raw)
    except deck_lib.RootError as exc:
        return 400, {"error": exc.code, "detail": str(exc)}
    return 200, {"roots": roots, "added": str(deck_lib.validate_root(raw))}


# --- async folder picker -------------------------------------------------
# The gateway proxy times out after ~30s, but a user may keep the OS folder
# dialog open far longer. So the dialog runs in a background thread and the
# UI polls for its outcome instead of blocking one request on it.
_PICKS: dict[str, dict[str, Any]] = {}
_PICKS_LOCK = threading.Lock()
_PICK_TTL = 600


def _pick_worker(pick_id: str) -> None:
    try:
        path = _pick_folder()
        if path is None:
            outcome = {"state": "cancelled"}
        else:
            try:
                roots = deck_lib.add_root(DATA_DIR, path)
                outcome = {"state": "added", "roots": roots, "added": str(deck_lib.validate_root(path))}
            except deck_lib.RootError as exc:
                outcome = {"state": "error", "error": exc.code, "detail": str(exc)}
    except Exception as exc:  # chooser failed to open, timeout, ...
        outcome = {"state": "error", "error": "folder_chooser_failed", "detail": str(exc)}
    with _PICKS_LOCK:
        _PICKS[pick_id].update(outcome, finished=time.time())


def route_roots_pick_start(_h: "Handler", _body: dict[str, Any]) -> tuple[int, Any]:
    if not _picker_supported():
        return 400, {"error": "picker_unsupported"}
    pick_id = uuid.uuid4().hex[:12]
    with _PICKS_LOCK:
        # Drop stale records; refuse a second concurrent dialog.
        now = time.time()
        for k in [k for k, v in _PICKS.items() if v.get("finished") and now - v["finished"] > _PICK_TTL]:
            _PICKS.pop(k, None)
        if any(v["state"] == "pending" for v in _PICKS.values()):
            return 409, {"error": "picker_busy"}
        _PICKS[pick_id] = {"state": "pending", "started": now}
    threading.Thread(target=_pick_worker, args=(pick_id,), daemon=True).start()
    return 200, {"id": pick_id, "state": "pending"}


def route_roots_pick_status(h: "Handler", _body: dict[str, Any]) -> tuple[int, Any]:
    pick_id = parse_qs(urlsplit(h.path).query).get("id", [""])[0]
    with _PICKS_LOCK:
        rec = _PICKS.get(pick_id)
        if rec is None:
            return 404, {"error": "unknown_pick"}
        return 200, {"id": pick_id, **{k: v for k, v in rec.items() if k not in ("started", "finished")}}


def route_roots_remove(_h: "Handler", body: dict[str, Any]) -> tuple[int, Any]:
    raw = body.get("path")
    if not isinstance(raw, str):
        return 400, {"error": "path_required"}
    return 200, {"roots": deck_lib.remove_root(DATA_DIR, raw)}


def route_decks(_h: "Handler", _body: dict[str, Any]) -> tuple[int, Any]:
    roots = deck_lib.list_roots(DATA_DIR)
    return 200, {"roots": roots, "decks": deck_lib.scan_decks(roots)}


_CSS_CANDIDATES = ("assets/deck.css", "out/assets/deck.css", "deck.css", "tokens.css")


def _deck_under_roots(raw: str) -> Path | None:
    """Return the deck folder if it lives under a registered root, else None."""
    try:
        deck = Path(raw).resolve()
    except (OSError, RuntimeError):
        return None
    if not deck.is_dir():
        return None
    for root in deck_lib.list_roots(DATA_DIR):
        r = Path(root).resolve()
        if deck == r or r in deck.parents:
            return deck
    return None


def _deck_css(deck: Path) -> str | None:
    """Pick the deck's stylesheet: studio.json 'css' first, then common locations."""
    studio = deck_lib._read_studio(deck) or {}
    candidates = []
    if isinstance(studio.get("css"), str) and studio["css"].strip():
        candidates.append(studio["css"].strip())
    candidates.extend(_CSS_CANDIDATES)
    for rel in candidates:
        target = (deck / rel)
        try:
            target.resolve().relative_to(deck.resolve())
        except ValueError:
            continue
        if target.is_file():
            return rel
    return None


def route_preview_start(_h: "Handler", body: dict[str, Any]) -> tuple[int, Any]:
    deck = _deck_under_roots(str(body.get("path", "")))
    if deck is None:
        return 400, {"error": "deck_not_allowed"}
    info = deck_lib.describe_deck(deck, deck)
    if info is None:
        return 404, {"error": "not_a_deck"}
    css = _deck_css(deck)
    entry = info.get("entry")
    output = build_lib.build_contract(deck, entry)["output"]
    p = PREVIEWS.ensure(deck, info["slidesDir"], css, extra_files=(output,), entry=entry)
    return 200, {
        "port": p.port,
        "baseUrl": f"http://127.0.0.1:{p.port}",
        "slides": info["slides"],
        "kind": info["kind"],
        "css": css,
        "output": output,
        "stage": {"width": preview_lib.STAGE_W, "height": preview_lib.STAGE_H},
    }


def route_preview_stop(_h: "Handler", body: dict[str, Any]) -> tuple[int, Any]:
    raw = str(body.get("path", ""))
    stopped = PREVIEWS.stop(Path(raw)) if raw else False
    return 200, {"stopped": stopped}


def route_build_info(_h: "Handler", body: dict[str, Any]) -> tuple[int, Any]:
    deck = _deck_under_roots(str(body.get("path", "")))
    if deck is None:
        return 400, {"error": "deck_not_allowed"}
    deck_info = deck_lib.describe_deck(deck, deck)
    info = build_lib.build_contract(deck, deck_info.get("entry") if deck_info else None)
    info["trusted"] = bool(info["command"]) and build_lib.is_trusted(DATA_DIR, deck, info["command"])
    return 200, info


def route_build(_h: "Handler", body: dict[str, Any]) -> tuple[int, Any]:
    """Run the deck build. ``{"trust": true}`` records consent for the declared command."""
    deck = _deck_under_roots(str(body.get("path", "")))
    if deck is None:
        return 400, {"error": "deck_not_allowed"}
    info = deck_lib.describe_deck(deck, deck)
    if info is None:
        return 404, {"error": "not_a_deck"}
    try:
        result = build_lib.build(
            DATA_DIR, deck, info["slidesDir"], trust_command=bool(body.get("trust")),
            entry=info.get("entry"), css_rel=_deck_css(deck),
        )
    except build_lib.BuildError as exc:
        if exc.code == "not_buildable":
            return 200, {"ok": False, "error": exc.code, "stderr": str(exc)}
        # Consent is a normal outcome, not a transport error: answer 200 so the
        # UI gets the command text regardless of how the SDK surfaces non-2xx.
        return 200, {"ok": False, "needsTrust": True, "error": exc.code, "command": str(exc)}
    return 200, result


# --- present / pdf --------------------------------------------------------
def _output_url(deck: Path) -> tuple[str, str] | None:
    """(preview base url, output rel) for a deck whose output exists; None otherwise."""
    info = deck_lib.describe_deck(deck, deck)
    if info is None:
        return None
    contract = build_lib.build_contract(deck, info.get("entry"))
    if not contract["outputExists"]:
        return None
    p = PREVIEWS.ensure(deck, info["slidesDir"], _deck_css(deck), extra_files=(contract["output"],), entry=info.get("entry"))
    return f"http://127.0.0.1:{p.port}", contract["output"]


def route_present(_h: "Handler", body: dict[str, Any]) -> tuple[int, Any]:
    """Open the built deck in the system browser (fallback when the dashboard blocks window.open)."""
    deck = _deck_under_roots(str(body.get("path", "")))
    if deck is None:
        return 400, {"error": "deck_not_allowed"}
    target = _output_url(deck)
    if target is None:
        return 409, {"error": "no_output"}
    base, output = target
    slide = body.get("slide")
    frag = f"#{int(slide)}" if isinstance(slide, int) and slide > 0 else ""
    url = f"{base}/{output}{frag}"
    opener = ["open", url] if sys.platform == "darwin" else ["xdg-open", url]
    try:
        subprocess.Popen(opener, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except OSError as exc:
        return 500, {"error": "open_failed", "detail": str(exc)}
    return 200, {"url": url}


def route_pdf_start(_h: "Handler", body: dict[str, Any]) -> tuple[int, Any]:
    deck = _deck_under_roots(str(body.get("path", "")))
    if deck is None:
        return 400, {"error": "deck_not_allowed"}
    browser = export_lib.find_browser()
    if browser is None:
        return 400, {"error": "no_browser"}
    # The PDF is rendered from the preview server's /print document (every slide
    # as one page, with the deck's own print CSS), so no build is required.
    info = deck_lib.describe_deck(deck, deck)
    if info is None:
        return 409, {"error": "not_a_deck"}
    p = PREVIEWS.ensure(deck, info["slidesDir"], _deck_css(deck), entry=info.get("entry"))
    out_path = deck / export_lib.safe_pdf_name(deck.name)
    job_id = PDF_JOBS.start(browser, f"http://127.0.0.1:{p.port}/print", out_path)
    return 200, {"id": job_id, "state": "running", "output": str(out_path)}


def route_pdf_status(h: "Handler", _body: dict[str, Any]) -> tuple[int, Any]:
    job_id = parse_qs(urlsplit(h.path).query).get("id", [""])[0]
    rec = PDF_JOBS.status(job_id)
    if rec is None:
        return 404, {"error": "unknown_job"}
    return 200, rec


def route_reveal(_h: "Handler", body: dict[str, Any]) -> tuple[int, Any]:
    """Reveal a produced file (PDF) in the OS file manager."""
    deck = _deck_under_roots(str(body.get("path", "")))
    target = str(body.get("file", ""))
    if deck is None or not target:
        return 400, {"error": "deck_not_allowed"}
    file = (deck / target).resolve()
    if deck.resolve() not in file.parents or not file.is_file():
        return 404, {"error": "not_found"}
    opener = ["open", "-R", str(file)] if sys.platform == "darwin" else ["xdg-open", str(file.parent)]
    subprocess.Popen(opener, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return 200, {"revealed": str(file)}


ROUTES: dict[tuple[str, str], Route] = {
    ("GET", "/health"): route_health,
    ("GET", "/status"): route_status,
    ("GET", "/roots"): route_roots,
    ("POST", "/roots/add"): route_roots_add,
    ("POST", "/roots/pick"): route_roots_pick_start,
    ("GET", "/roots/pick"): route_roots_pick_status,
    ("POST", "/roots/remove"): route_roots_remove,
    ("GET", "/decks"): route_decks,
    ("POST", "/preview/start"): route_preview_start,
    ("POST", "/preview/stop"): route_preview_stop,
    ("POST", "/build/info"): route_build_info,
    ("POST", "/build"): route_build,
    ("POST", "/present"): route_present,
    ("POST", "/pdf"): route_pdf_start,
    ("GET", "/pdf"): route_pdf_status,
    ("POST", "/reveal"): route_reveal,
}

# Routes reachable without the gateway signature (gateway health probe only).
UNAUTHENTICATED = {("GET", "/health")}


def normalize_path(raw_path: str) -> str:
    """Strip the ``/api`` prefix the gateway forwards so routes are declared once."""
    path = urlsplit(raw_path).path
    if path == "/api":
        return "/"
    if path.startswith("/api/"):
        return path[4:]
    return path


# ------------------------------------------------------------------------ handler
class Handler(BaseHTTPRequestHandler):
    server_version = f"html-studio/{APP_VERSION}"

    def do_GET(self) -> None:  # noqa: N802 (http.server naming)
        self._dispatch("GET")

    def do_POST(self) -> None:  # noqa: N802
        self._dispatch("POST")

    def do_PUT(self) -> None:  # noqa: N802
        self._dispatch("PUT")

    def _dispatch(self, method: str) -> None:
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length > 0 else b""
        key = (method, normalize_path(self.path))

        if key not in UNAUTHENTICATED and not verify_proxy_signature(
            self.headers.get(_PROXY_HEADER, ""), method=method, target=self.path, body=body
        ):
            _log(f"401 {method} {self.path} (proxy signature missing or invalid)")
            self._json(401, {"error": "invalid_proxy_signature"})
            return

        handler = ROUTES.get(key)
        if handler is None:
            _log(f"404 {method} {self.path}")
            self._json(404, {"error": "unknown_route", "path": key[1], "version": APP_VERSION})
            return

        try:
            payload = json.loads(body) if body else {}
            if not isinstance(payload, dict):
                payload = {}
        except json.JSONDecodeError:
            self._json(400, {"error": "invalid_json"})
            return

        try:
            code, data = handler(self, payload)
        except Exception as exc:  # keep the server alive on handler bugs
            self._json(500, {"error": "internal", "detail": str(exc)})
            return
        self._json(code, data)

    def _json(self, code: int, data: Any) -> None:
        raw = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, *_args: Any) -> None:  # silence default access log
        return


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    print(f"{APP_NAME} backend v{APP_VERSION} listening on 127.0.0.1:{PORT}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
