"""Per-deck preview servers.

Each opened deck gets its own read-only HTTP server bound to ``127.0.0.1`` on
an ephemeral port. Slide previews are never served from the dashboard origin:
a deck is user/agent-authored HTML and must not run with the dashboard's
session cookie.

Routes (all GET):
  /health                    liveness
  /slide/<index>             one slide fragment wrapped into a full page
  /assets/<path>, /img/<path>, /out/<path>
                             static files from the deck folder (contained)

The wrapper forces the single slide visible: deck stylesheets normally hide
``.slide`` until it carries ``.active``.
"""
from __future__ import annotations

import html
import mimetypes
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit

STAGE_W, STAGE_H = 1280, 720
_STATIC_PREFIXES = ("assets", "img", "out")
_TEXT_TYPES = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
               ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml"}


def default_theme_css() -> str:
    """Minimal neutral theme used when a deck ships no stylesheet."""
    return f"""
:root {{ --hs-bg:#ffffff; --hs-fg:#1f2430; --hs-muted:#6b7280; --hs-accent:#6d5efc; --hs-border:#e5e7eb; }}
html,body {{ margin:0; background:var(--hs-bg); color:var(--hs-fg);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR","Apple SD Gothic Neo",sans-serif; }}
.slide {{ box-sizing:border-box; width:{STAGE_W}px; height:{STAGE_H}px; padding:56px 64px; display:flex; flex-direction:column; gap:20px; overflow:hidden; }}
.slide h1 {{ font-size:56px; margin:0; line-height:1.1; letter-spacing:-.02em; }}
.slide h2 {{ font-size:32px; margin:0; line-height:1.2; }}
.slide h3 {{ font-size:22px; margin:0; }}
.slide p, .slide li {{ font-size:20px; line-height:1.5; }}
.slide .muted {{ color:var(--hs-muted); }}
.slide .accent {{ color:var(--hs-accent); }}
.slide.cover, .slide.divider {{ background:linear-gradient(135deg,#1e1b4b,#312e81); color:#fff; justify-content:center; }}
"""


def wrap_slide(
    fragment: str, *, css_href: str | None, extra_css: str = "", title: str = "", page_number: int | None = None
) -> str:
    """Return a standalone page that renders one slide fragment at stage size.

    ``<base href="/">`` makes the slide's relative references (``img/x.png``,
    and ``url(img/logo.png)`` inside the deck stylesheet) resolve against the
    deck root even though the page itself lives at ``/slide/<n>``.
    """
    link = f'<link rel="stylesheet" href="{html.escape(css_href, quote=True)}">' if css_href else ""
    inline = "" if css_href else f"<style>{default_theme_css()}</style>"
    force = (
        "<style>"
        f"html,body{{margin:0;overflow:hidden;width:{STAGE_W}px;height:{STAGE_H}px}}"
        ".hs-stage{position:relative;width:%dpx;height:%dpx;overflow:hidden}" % (STAGE_W, STAGE_H)
        + ".hs-stage>.slide{display:flex!important;position:absolute;inset:0;animation:none!important}"
        + extra_css
        + "</style>"
    )
    if page_number is not None:
        fragment = _inject_pageno(fragment, page_number)
    return (
        "<!doctype html><html><head><meta charset=\"utf-8\"><base href=\"/\">"
        f"<title>{html.escape(title)}</title>{link}{inline}{force}</head>"
        f"<body><div class=\"hs-stage\">{fragment}</div></body></html>"
    )


_FOOT_RE = re.compile(r'(<div class="slide-foot"[^>]*>)(.*?)(</div>)', re.S)


def _inject_pageno(fragment: str, n: int) -> str:
    """Append ``<span class="pageno">n</span>`` to a ``.slide-foot`` that lacks one.

    Deck runtimes usually do this at show time; doing it here keeps the preview
    iframe script-free while still matching the built output.
    """
    def repl(m: re.Match[str]) -> str:
        if 'class="pageno"' in m.group(2):
            return m.group(0)
        return f'{m.group(1)}{m.group(2)}<span class="pageno">{n}</span>{m.group(3)}'

    return _FOOT_RE.sub(repl, fragment, count=1)


class DeckPreview:
    """One running preview server for one deck folder."""

    def __init__(self, deck_dir: Path, slides_dir: str, css_rel: str | None) -> None:
        self.deck_dir = deck_dir.resolve()
        self.slides_dir = (self.deck_dir / slides_dir).resolve()
        self.css_rel = css_rel  # e.g. "assets/deck.css" or None for the default theme
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    # --- lifecycle
    def start(self) -> int:
        preview = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:  # noqa: N802
                preview._handle(self)

            def log_message(self, *_a: Any) -> None:
                return

        self._server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()
        return self.port

    def stop(self) -> None:
        if self._server:
            self._server.shutdown()
            self._server.server_close()
            self._server = None

    @property
    def port(self) -> int:
        return self._server.server_address[1] if self._server else 0

    # --- slides
    def slide_files(self) -> list[Path]:
        if not self.slides_dir.is_dir():
            return []
        return sorted(p for p in self.slides_dir.iterdir() if p.is_file() and p.suffix.lower() == ".html")

    def render_slide(self, index: int) -> str | None:
        files = self.slide_files()
        if index < 0 or index >= len(files):
            return None
        fragment = files[index].read_text(encoding="utf-8", errors="replace")
        css_href = f"/{self.css_rel}" if self.css_rel and (self.deck_dir / self.css_rel).is_file() else None
        return wrap_slide(fragment, css_href=css_href, title=files[index].name, page_number=index + 1)

    # --- static
    def resolve_static(self, url_path: str) -> Path | None:
        """Map ``/assets/x`` etc. onto a file inside the deck folder, or None."""
        parts = [p for p in unquote(url_path).split("/") if p]
        if not parts or parts[0] not in _STATIC_PREFIXES or any(p in ("..", "") for p in parts):
            return None
        target = (self.deck_dir / Path(*parts)).resolve()
        if self.deck_dir not in target.parents:
            return None
        return target if target.is_file() else None

    # --- dispatch
    def _handle(self, h: BaseHTTPRequestHandler) -> None:
        path = urlsplit(h.path).path
        if path == "/health":
            return _send(h, 200, b'{"status":"ok"}', "application/json")
        if path.startswith("/slide/"):
            try:
                idx = int(path[len("/slide/"):])
            except ValueError:
                return _send(h, 400, b"bad slide index", "text/plain")
            page = self.render_slide(idx)
            if page is None:
                return _send(h, 404, b"no such slide", "text/plain")
            return _send(h, 200, page.encode("utf-8"), "text/html; charset=utf-8")
        target = self.resolve_static(path)
        if target is None:
            return _send(h, 404, b"not found", "text/plain")
        ctype = _TEXT_TYPES.get(target.suffix.lower()) or mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        return _send(h, 200, target.read_bytes(), ctype)


def _send(h: BaseHTTPRequestHandler, code: int, body: bytes, ctype: str) -> None:
    h.send_response(code)
    h.send_header("Content-Type", ctype)
    h.send_header("Content-Length", str(len(body)))
    h.send_header("Cache-Control", "no-store")
    h.end_headers()
    h.wfile.write(body)


class PreviewRegistry:
    """Deck path -> running preview. Thread-safe; one server per deck."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._by_deck: dict[str, DeckPreview] = {}

    def ensure(self, deck_dir: Path, slides_dir: str, css_rel: str | None) -> DeckPreview:
        key = str(deck_dir.resolve())
        with self._lock:
            existing = self._by_deck.get(key)
            if existing and existing.port:
                return existing
            preview = DeckPreview(deck_dir, slides_dir, css_rel)
            preview.start()
            self._by_deck[key] = preview
            return preview

    def stop(self, deck_dir: Path) -> bool:
        key = str(deck_dir.resolve())
        with self._lock:
            preview = self._by_deck.pop(key, None)
        if preview:
            preview.stop()
        return preview is not None

    def stop_all(self) -> None:
        with self._lock:
            items = list(self._by_deck.values())
            self._by_deck.clear()
        for p in items:
            p.stop()
