"""Per-deck preview servers.

Each opened deck gets its own read-only HTTP server bound to ``127.0.0.1`` on
an ephemeral port. Slide previews are never served from the dashboard origin:
a deck is user/agent-authored HTML and must not run with the dashboard's
session cookie.

Routes (all GET):
  /health                    liveness
  /slide/<index>             one slide fragment wrapped into a full page
  /print                     every slide as one 1280x720 page (PDF export)
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
    fragment: str,
    *,
    css_href: str | None,
    extra_css: str = "",
    title: str = "",
    page_number: int | None = None,
    head_extra: str = "",
) -> str:
    """Return a standalone page that renders one slide fragment at stage size.

    ``<base href="/">`` makes the slide's relative references (``img/x.png``,
    and ``url(img/logo.png)`` inside the deck stylesheet) resolve against the
    deck root even though the page itself lives at ``/slide/<n>``.
    ``head_extra`` carries a single-file deck's own ``<link>``/``<style>`` tags.
    """
    link = f'<link rel="stylesheet" href="{html.escape(css_href, quote=True)}">' if css_href else ""
    inline = "" if (css_href or head_extra) else f"<style>{default_theme_css()}</style>"
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
        f"<title>{html.escape(title)}</title>{head_extra}{link}{inline}{force}</head>"
        f"<body><div class=\"hs-stage\">{fragment}</div></body></html>"
    )


_SECTION_RE = re.compile(r"<section\b[^>]*>.*?</section>", re.S | re.I)
_CLASS_ATTR_RE = re.compile(r"""^<section\b[^>]*\bclass=(["'])(.*?)\1""", re.I | re.S)
_HEAD_RE = re.compile(r"<head\b[^>]*>(.*?)</head>", re.S | re.I)
_HEAD_KEEP_RE = re.compile(r"<link\b[^>]*rel=[\"']?stylesheet[\"']?[^>]*>|<style\b[^>]*>.*?</style>", re.S | re.I)
_HIDDEN_SVG_RE = re.compile(r"<svg\b[^>]*display:\s*none[^>]*>.*?</svg>", re.S | re.I)


def _is_slide_section(block: str) -> bool:
    m = _CLASS_ATTR_RE.match(block)
    return bool(m) and "slide" in m.group(2).split()


def split_sections(document: str) -> list[str]:
    """Top-level ``<section class="... slide ...">`` blocks of a built single-file deck.

    Slides are assumed not to nest ``<section>`` elements (true for slide decks
    in practice); a nested section would truncate its parent.
    """
    return [m.group(0) for m in _SECTION_RE.finditer(document) if _is_slide_section(m.group(0))]


def inherited_chrome(document: str) -> tuple[str, str]:
    """(head_extra, hidden_markup) a single slide needs from its source document.

    ``head_extra`` = the document's stylesheet links and inline styles;
    ``hidden_markup`` = hidden inline SVG symbol libraries that slides reference
    via ``<use href="#id">``.
    """
    head = _HEAD_RE.search(document)
    head_extra = "".join(m.group(0) for m in _HEAD_KEEP_RE.finditer(head.group(1))) if head else ""
    hidden = "".join(m.group(0) for m in _HIDDEN_SVG_RE.finditer(document))
    return head_extra, hidden


_FOOT_RE = re.compile(r"""(<div\b[^>]*\bclass=(["'])[^"']*\bslide-foot\b[^"']*\2[^>]*>)(.*?)(</div>)""", re.S)


def _inject_pageno(fragment: str, n: int) -> str:
    """Append ``<span class="pageno">n</span>`` to a ``.slide-foot`` that lacks one.

    Deck runtimes usually do this at show time; doing it here keeps the preview
    iframe script-free while still matching the built output.
    """
    def repl(m: re.Match[str]) -> str:
        if "pageno" in m.group(3):
            return m.group(0)
        return f'{m.group(1)}{m.group(3)}<span class="pageno">{n}</span>{m.group(4)}'

    return _FOOT_RE.sub(repl, fragment, count=1)


class DeckPreview:
    """One running preview server for one deck folder."""

    def __init__(
        self,
        deck_dir: Path,
        slides_dir: str,
        css_rel: str | None,
        extra_files: tuple[str, ...] = (),
        entry: str | None = None,
    ) -> None:
        self.deck_dir = deck_dir.resolve()
        self.slides_dir = (self.deck_dir / slides_dir).resolve()
        self.css_rel = css_rel  # e.g. "assets/deck.css" or None for the default theme
        # Single-file deck: slides are <section class="slide"> blocks inside this file.
        self.entry = entry
        # Individual files outside the static prefixes that may be served, e.g. the
        # deck's declared build output ("index.html").
        self.extra_files = frozenset(f.strip("/") for f in extra_files if f)
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

    def slide_count(self) -> int:
        if self.entry:
            return len(split_sections(self._entry_text()))
        return len(self.slide_files())

    def _entry_text(self) -> str:
        path = self.deck_dir / (self.entry or "")
        try:
            return path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return ""

    def render_slide(self, index: int) -> str | None:
        if self.entry:
            text = self._entry_text()
            sections = split_sections(text)
            if index < 0 or index >= len(sections):
                return None
            head_extra, hidden = inherited_chrome(text)
            return wrap_slide(
                hidden + sections[index],
                css_href=None if head_extra else self._css_href(),
                head_extra=head_extra,
                title=f"{self.entry}#{index + 1}",
                page_number=index + 1,
            )
        files = self.slide_files()
        if index < 0 or index >= len(files):
            return None
        fragment = files[index].read_text(encoding="utf-8", errors="replace")
        return wrap_slide(fragment, css_href=self._css_href(), title=files[index].name, page_number=index + 1)

    def render_print(self) -> str:
        """One document with every slide laid out as a 1280x720 page, for PDF export.

        This is what "print this deck in Chrome" would render: the deck's own
        stylesheet (including its ``@media print`` rules) plus a small forced
        layout so each slide is exactly one page, whatever runtime built the
        deck (or none). No app chrome, no dark backdrop, no counter.
        """
        head_extra = ""
        if self.entry:
            text = self._entry_text()
            head_extra, hidden = inherited_chrome(text)
            fragments = [hidden + sec for sec in split_sections(text)]
            title = self.entry
        else:
            fragments = [f.read_text(encoding="utf-8", errors="replace") for f in self.slide_files()]
            title = self.deck_dir.name
        css_href = None if head_extra else self._css_href()
        link = f'<link rel="stylesheet" href="{html.escape(css_href, quote=True)}">' if css_href else ""
        inline = "" if (css_href or head_extra) else f"<style>{default_theme_css()}</style>"
        force = (
            "<style>"
            f"@page{{size:{STAGE_W}px {STAGE_H}px;margin:0}}"
            f"html,body{{margin:0;padding:0;background:#fff;width:{STAGE_W}px}}"
            "*,*::before,*::after{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}"
            ".hs-print>.slide:not(.is-hidden):not([hidden]){display:flex!important;position:relative!important;inset:auto!important;"
            f"width:{STAGE_W}px!important;height:{STAGE_H}px!important;margin:0!important;overflow:hidden;"
            "break-after:page;page-break-after:always;break-inside:avoid;page-break-inside:avoid;animation:none!important;transition:none!important}"
            ".hs-print>.slide:last-child{break-after:auto;page-break-after:auto}"
            ".hs-print .slide *{animation:none!important;transition:none!important}"
            "</style>"
        )
        body = "".join(_inject_pageno(frag, i + 1) for i, frag in enumerate(fragments))
        return (
            "<!doctype html><html><head><meta charset=\"utf-8\"><base href=\"/\">"
            f"<title>{html.escape(title)}</title>{head_extra}{link}{inline}{force}</head>"
            f"<body class=\"hs-print stage\">{body}</body></html>"
        )

    def _css_href(self) -> str | None:
        return f"/{self.css_rel}" if self.css_rel and (self.deck_dir / self.css_rel).is_file() else None

    # --- static
    def resolve_static(self, url_path: str) -> Path | None:
        """Map ``/assets/x`` etc. (or an allowed extra file) onto a file inside the deck."""
        parts = [p for p in unquote(url_path).split("/") if p]
        if not parts or any(p in ("..", "") for p in parts):
            return None
        rel = "/".join(parts)
        if parts[0] not in _STATIC_PREFIXES and rel not in self.extra_files:
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
        if path == "/print":
            return _send(h, 200, self.render_print().encode("utf-8"), "text/html; charset=utf-8")
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

    def ensure(
        self,
        deck_dir: Path,
        slides_dir: str,
        css_rel: str | None,
        extra_files: tuple[str, ...] = (),
        entry: str | None = None,
    ) -> DeckPreview:
        key = str(deck_dir.resolve())
        wanted = frozenset(f.strip("/") for f in extra_files if f)
        with self._lock:
            existing = self._by_deck.get(key)
            if existing and existing.port and existing.extra_files == wanted and existing.entry == entry:
                return existing
            if existing:
                existing.stop()
            preview = DeckPreview(deck_dir, slides_dir, css_rel, extra_files, entry)
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
