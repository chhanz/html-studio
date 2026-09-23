"""Per-deck preview servers.

Each opened deck gets its own read-only HTTP server bound to ``127.0.0.1`` on
an ephemeral port. Slide previews are never served from the dashboard origin:
a deck is user/agent-authored HTML and must not run with the dashboard's
session cookie.

Routes (all GET):
  /health                    liveness
  /slide/<index>             one slide fragment wrapped into a full page (?hs=select adds the overlay)
  /print                     every slide as one 1280x720 page (PDF export)
  /check                     measures every slide (deck check, headless)
  /presenter?lang=           the presenter window (notes, next slide, timer, laser)
  /present/state             shared presenter state (GET/POST, loopback CORS)
  /present/events            the same state pushed as Server-Sent Events
  /note?slide=               speaker note text for the presenter window
  /assets/<path>, /img/<path>, /out/<path>
                             static files from the deck folder (contained)

The wrapper forces the single slide visible: deck stylesheets normally hide
``.slide`` until it carries ``.active``.
"""
from __future__ import annotations

import html
import json
import mimetypes
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlsplit

import notes as notes_lib

STAGE_W, STAGE_H = 1280, 720
_STATIC_PREFIXES = ("assets", "img", "out")
_TEXT_TYPES = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
               ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml"}


def is_tokens_css(css_href: str) -> bool:
    """``tokens.css`` (generated from DESIGN.md) is an overlay on the default
    theme, not a replacement: it only defines custom properties."""
    return css_href.rsplit("/", 1)[-1] == "tokens.css"


def default_theme_css() -> str:
    """Minimal neutral theme used when a deck ships no stylesheet."""
    return f"""
:root {{ --hs-bg:#ffffff; --hs-fg:#1f2430; --hs-muted:#6b7280; --hs-accent:#6d5efc; --hs-border:#e5e7eb; }}
html,body {{ margin:0; background:var(--hs-bg); color:var(--hs-fg);
  font-family:var(--hs-font, -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR","Apple SD Gothic Neo",sans-serif); }}
.slide {{ box-sizing:border-box; width:{STAGE_W}px; height:{STAGE_H}px; padding:56px 64px; display:flex; flex-direction:column; gap:20px; overflow:hidden; }}
.slide h1 {{ font-size:56px; margin:0; line-height:1.1; letter-spacing:-.02em; }}
.slide h2 {{ font-size:32px; margin:0; line-height:1.2; }}
.slide h3 {{ font-size:22px; margin:0; }}
.slide p, .slide li {{ font-size:20px; line-height:1.5; }}
.slide .muted {{ color:var(--hs-muted); }}
.slide .accent {{ color:var(--hs-accent); }}
.slide.cover, .slide.divider {{ background:var(--hs-cover, linear-gradient(135deg,#1e1b4b,#312e81)); color:var(--hs-on-cover, #fff); justify-content:center; }}
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
    inline = "" if head_extra or (css_href and not is_tokens_css(css_href)) else f"<style>{default_theme_css()}</style>"
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
        f"<title>{html.escape(title)}</title>{head_extra}{inline}{link}{force}</head>"
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


# Helper injected into the built deck when it is shown inside the studio's
# presenter (``?hs=present``). The presenter is a different origin, so it cannot
# inspect the deck's DOM; instead it sends the click point and this script
# answers with the image under it (or a miss). Raster images are handed over as
# data URLs: the dashboard's Content-Security-Policy allows ``img-src data:``
# but not an ``http://127.0.0.1`` source, so the presenter cannot load the file
# itself. Nothing else about the deck is changed.
PRESENT_HELPER_JS = (
    "<script>(function(){"
    "function pick(el){while(el&&el!==document.documentElement){"
    "if(el.tagName==='IMG'&&(el.currentSrc||el.src))return{kind:'img',src:el.currentSrc||el.src,alt:el.alt||''};"
    "if(el.tagName&&el.tagName.toLowerCase()==='svg'){var r=el.getBoundingClientRect();if(r.width>=64&&r.height>=64)"
    "return{kind:'svg',svg:new XMLSerializer().serializeToString(el)};}"
    "var bg=getComputedStyle(el).backgroundImage,m=bg&&/url\\((['\"]?)([^'\")]+)\\1\\)/.exec(bg);"
    "if(m&&el.getBoundingClientRect().width>=64)return{kind:'img',src:new URL(m[2],location.href).href,alt:''};"
    "el=el.parentElement;}return null;}"
    "function reply(msg){parent.postMessage(msg,'*');}"
    "function asData(hit){if(/^data:/.test(hit.src))return reply(Object.assign({type:'hs-zoom'},hit));"
    "fetch(hit.src).then(function(r){return r.blob();}).then(function(b){var fr=new FileReader();"
    "fr.onload=function(){reply({type:'hs-zoom',kind:'img',src:fr.result,alt:hit.alt});};fr.readAsDataURL(b);})"
    ".catch(function(){reply({type:'hs-miss'});});}"
    "addEventListener('message',function(e){var m=e.data||{};if(m.type!=='hs-hit')return;"
    "var hit=pick(document.elementFromPoint(m.x,m.y));"
    "if(!hit)return reply({type:'hs-miss'});if(hit.kind==='img')return asData(hit);reply(Object.assign({type:'hs-zoom'},hit));});"
    "})();</script>"
)
_BODY_END_RE = re.compile(r"</body>", re.I)
_INJECT_DIR = Path(__file__).resolve().parent / "inject"


def select_helper_js() -> str:
    """The select-to-edit overlay (inject/select.js), read on each call so a dev
    edit is picked up without a restart; it is a few KB."""
    return (_INJECT_DIR / "select.js").read_text(encoding="utf-8")


def inject_select_helper(page: str) -> str:
    """Return the slide page with the select-to-edit overlay appended."""
    script = "<script>" + select_helper_js() + "</script>"
    if _BODY_END_RE.search(page):
        return _BODY_END_RE.sub(lambda _m: script + "</body>", page, count=1)
    return page + script


def check_document(count: int, stage: tuple[int, int] = (STAGE_W, STAGE_H)) -> str:
    """The /check page: loads every slide in an iframe and measures it (inject/check.js)."""
    cfg = json.dumps({"count": count, "base": "", "stage": {"width": stage[0], "height": stage[1]}})
    js = (_INJECT_DIR / "check.js").read_text(encoding="utf-8")
    return (
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>hs-check</title></head>"
        f"<body><script>window.HS_CHECK={cfg}</script><script>{js}</script></body></html>"
    )


def _inject_script(page: str, js: str) -> str:
    script = "<script>" + js + "</script>"
    if _BODY_END_RE.search(page):
        return _BODY_END_RE.sub(lambda _m: script + "</body>", page, count=1)
    return page + script


def inject_audience_bridge(page: str) -> str:
    """Return the built deck with the audience-window bridge (inject/audience.js) appended."""
    script = "<script>" + (_INJECT_DIR / "audience.js").read_text(encoding="utf-8") + "</script>"
    if _BODY_END_RE.search(page):
        return _BODY_END_RE.sub(lambda _m: script + "</body>", page, count=1)
    return page + script


def inject_present_helper(page: str) -> str:
    """Return the page with the presenter helper appended to its body."""
    if _BODY_END_RE.search(page):
        return _BODY_END_RE.sub(lambda _m: PRESENT_HELPER_JS + "</body>", page, count=1)
    return page + PRESENT_HELPER_JS


class PresentState:
    """Shared presenter state for one deck, relayed through the preview server.

    The presenter view (inside the dashboard) and the audience window (a system
    browser) are different browser processes, so nothing client-side can link
    them; both talk to this loopback server instead. Only slide index, blackout
    and laser coordinates live here, so it needs no authentication.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._changed = threading.Condition(self._lock)
        self.seq = 0
        self.index = 0
        self.black = False
        self.laser: dict[str, Any] = {"on": False, "x": 0, "y": 0}
        self.presenter_seen = 0.0
        self.audience_seen = 0.0

    def snapshot(self) -> dict[str, Any]:
        now = time.time()
        with self._lock:
            return {
                "seq": self.seq,
                "index": self.index,
                "black": self.black,
                "laser": dict(self.laser),
                "presenter": now - self.presenter_seen < 5,
                "audience": now - self.audience_seen < 5,
            }

    def update(self, body: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            who = body.get("from")
            if who == "presenter":
                self.presenter_seen = time.time()
            elif who == "audience":
                self.audience_seen = time.time()
            changed = False
            if isinstance(body.get("index"), int) and body["index"] >= 0 and body["index"] != self.index:
                self.index = body["index"]
                changed = True
            if isinstance(body.get("black"), bool) and body["black"] != self.black:
                self.black = body["black"]
                changed = True
            laser = body.get("laser")
            if isinstance(laser, dict):
                new = {"on": bool(laser.get("on")), "x": int(laser.get("x") or 0), "y": int(laser.get("y") or 0)}
                if new != self.laser:
                    self.laser = new
                    changed = True
            if changed:
                self.seq += 1
                self._changed.notify_all()
        return self.snapshot()

    def wait_for_change(self, since: int, timeout: float) -> bool:
        """Block until seq advances past ``since`` or ``timeout`` elapses."""
        with self._lock:
            return self._changed.wait_for(lambda: self.seq != since, timeout=timeout)


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
        self.extra_files = frozenset(f.strip("/") for f in extra_files if f) | ({css_rel.strip("/")} if css_rel else frozenset())
        self.present = PresentState()
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    # --- lifecycle
    def start(self) -> int:
        preview = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self) -> None:  # noqa: N802
                preview._handle_post(self)

            def do_OPTIONS(self) -> None:  # noqa: N802
                # CORS preflight for /present/state from the dashboard (another loopback port).
                _send(self, 204, b"", "text/plain", cors=_cors_origin(self))

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

    def slide_names(self) -> list[str]:
        """Display names in slide order, as the deck list reports them
        (file names, or ``<entry>#<n>`` for a single-file deck)."""
        if self.entry:
            return [f"{self.entry}#{i + 1}" for i in range(self.slide_count())]
        return [p.name for p in self.slide_files()]

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

    def presenter_page(self, lang: str = "en") -> str:
        """The presenter window (inject/presenter.html) configured for this deck."""
        cfg = json.dumps({"count": self.slide_count(), "slides": self.slide_names(), "stage": {"width": STAGE_W, "height": STAGE_H}, "lang": lang})
        page = (_INJECT_DIR / "presenter.html").read_text(encoding="utf-8")
        marker = "<script>\n(function () {"
        config_tag = "<script>window.HS_PRESENTER=" + cfg + "</script>\n"
        return page.replace(marker, config_tag + marker, 1)

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
        inline = "" if head_extra or (css_href and not is_tokens_css(css_href)) else f"<style>{default_theme_css()}</style>"
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
            f"<title>{html.escape(title)}</title>{head_extra}{inline}{link}{force}</head>"
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
    def _present_events(self, h: BaseHTTPRequestHandler) -> None:
        """Server-Sent Events: push the presenter state the moment it changes.

        Polling cannot make a laser pointer smooth; this stream delivers every
        update (laser points included) with no polling gap. A comment line is
        sent every 15s as a keepalive; the client reconnects on its own.
        """
        cors = _cors_origin(h)
        try:
            h.send_response(200)
            h.send_header("Content-Type", "text/event-stream")
            h.send_header("Cache-Control", "no-store")
            h.send_header("Connection", "keep-alive")
            if cors:
                h.send_header("Access-Control-Allow-Origin", cors)
                h.send_header("Vary", "Origin")
            h.end_headers()
            since = -1
            while True:
                snap = self.present.snapshot()
                if snap["seq"] != since:
                    since = snap["seq"]
                    h.wfile.write(f"data: {json.dumps(snap)}\n\n".encode("utf-8"))
                    h.wfile.flush()
                if not self.present.wait_for_change(since, timeout=15.0):
                    h.wfile.write(b": keepalive\n\n")
                    h.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            return  # client went away

    def _handle_post(self, h: BaseHTTPRequestHandler) -> None:
        path = urlsplit(h.path).path
        if path != "/present/state":
            return _send(h, 404, b"not found", "text/plain")
        try:
            n = int(h.headers.get("Content-Length") or 0)
            body = json.loads(h.rfile.read(n).decode("utf-8") or "{}") if n else {}
        except (ValueError, OSError):
            return _send(h, 400, b"bad json", "text/plain")
        if not isinstance(body, dict):
            return _send(h, 400, b"bad json", "text/plain")
        return _send(h, 200, json.dumps(self.present.update(body)).encode("utf-8"), "application/json", cors=_cors_origin(h))

    def _handle(self, h: BaseHTTPRequestHandler) -> None:
        url = urlsplit(h.path)
        path = url.path
        if path == "/present/state":
            return _send(h, 200, json.dumps(self.present.snapshot()).encode("utf-8"), "application/json", cors=_cors_origin(h))
        if path == "/present/events":
            return self._present_events(h)
        if path == "/presenter":
            lang = parse_qs(url.query).get("lang", ["en"])[0][:5]
            return _send(h, 200, self.presenter_page(lang).encode("utf-8"), "text/html; charset=utf-8")
        if path == "/note":
            slide = parse_qs(url.query).get("slide", [""])[0]
            names = self.slide_names()
            if slide not in names:
                return _send(h, 404, b'{"error":"unknown_slide"}', "application/json")
            return _send(h, 200, json.dumps({"slide": slide, "text": notes_lib.read_note(self.deck_dir, slide)}).encode("utf-8"), "application/json")
        if path == "/health":
            return _send(h, 200, b'{"status":"ok"}', "application/json")
        if path == "/check":
            return _send(h, 200, check_document(self.slide_count()).encode("utf-8"), "text/html; charset=utf-8")
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
            if "select" in parse_qs(url.query).get("hs", []):
                page = inject_select_helper(page)
            return _send(h, 200, page.encode("utf-8"), "text/html; charset=utf-8")
        target = self.resolve_static(path)
        if target is None:
            return _send(h, 404, b"not found", "text/plain")
        ctype = _TEXT_TYPES.get(target.suffix.lower()) or mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        data = target.read_bytes()
        if ctype.startswith("text/html"):
            modes = parse_qs(url.query).get("hs", [])
            if "present" in modes:
                data = inject_present_helper(data.decode("utf-8", errors="replace")).encode("utf-8")
            elif "audience" in modes:
                data = inject_audience_bridge(data.decode("utf-8", errors="replace")).encode("utf-8")
        return _send(h, 200, data, ctype)


_LOOPBACK_ORIGIN_RE = re.compile(r"^https?://(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$")


def _cors_origin(h: BaseHTTPRequestHandler) -> str | None:
    """Echo a loopback Origin (the dashboard on another port); anything else gets no CORS."""
    origin = h.headers.get("Origin") or ""
    return origin if _LOOPBACK_ORIGIN_RE.match(origin) else None


def _send(h: BaseHTTPRequestHandler, code: int, body: bytes, ctype: str, cors: str | None = None) -> None:
    try:
        h.send_response(code)
        h.send_header("Content-Type", ctype)
        h.send_header("Content-Length", str(len(body)))
        h.send_header("Cache-Control", "no-store")
        if cors:
            h.send_header("Access-Control-Allow-Origin", cors)
            h.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            h.send_header("Access-Control-Allow-Headers", "Content-Type")
            h.send_header("Vary", "Origin")
        h.end_headers()
        h.wfile.write(body)
    except (BrokenPipeError, ConnectionResetError):
        # The client went away mid-response (an iframe reloading after a preview
        # restart does this routinely). Nothing to do and nothing to log.
        pass


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
        wanted = frozenset(f.strip("/") for f in extra_files if f) | ({css_rel.strip("/")} if css_rel else frozenset())
        with self._lock:
            existing = self._by_deck.get(key)
            if existing and existing.port and existing.extra_files == wanted and existing.entry == entry and existing.css_rel == css_rel:
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
