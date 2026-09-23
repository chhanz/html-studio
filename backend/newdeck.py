"""New deck wizard: create a deck folder from a few answers.

The result is an ordinary split deck the rest of the studio understands:

    <root>/<folder>/
      studio.json        slidesDir, css (when themed) and the deck's metadata
      slides/010_cover.html   the cover layout filled in (title, presenter, date)
      slides/020_agenda.html  the agenda layout, to be filled in
      brief.md           purpose, audience and source material: the agent's starting point
      DESIGN.md + tokens.css  when the theme is "design" (three colours + font)
      (copied stylesheet files)  when the theme is "copy" (from another deck)

Every file's content is produced here from the answers; the client never
supplies file names or markup. Text is HTML-escaped where it lands in a slide.
"""
from __future__ import annotations

import html
import json
import re
import shutil
import time
from pathlib import Path
from typing import Any

import decks as deck_lib
import design as design_lib
import layouts as layouts_lib

_FOLDER_RE = re.compile(r"^[\w][\w.\- ]{0,79}$", re.UNICODE)
_HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
MAX_FIELD = 4000


class NewDeckError(Exception):
    def __init__(self, code: str, detail: str = "") -> None:
        super().__init__(detail or code)
        self.code = code


def slugify(title: str) -> str:
    """A folder name suggestion from a title: letters, digits, '-'; Korean kept."""
    s = re.sub(r"[^\w\- ]", "", title, flags=re.UNICODE).strip().lower()
    s = re.sub(r"[\s_]+", "-", s).strip("-")
    return s[:60] or "deck"


def validate_folder(name: str) -> str:
    name = (name or "").strip()
    if not _FOLDER_RE.match(name) or name in (".", "..") or name.startswith(".") or name.endswith("."):
        raise NewDeckError("bad_folder")
    return name


def _field(answers: dict[str, Any], key: str, required: bool = False) -> str:
    v = answers.get(key, "")
    if not isinstance(v, str):
        v = ""
    v = v.strip()
    if required and not v:
        raise NewDeckError(f"missing_{key}")
    if len(v) > MAX_FIELD:
        raise NewDeckError("too_long")
    return v


def _cover_html(title: str, presenter: str, purpose: str, audience: str) -> str:
    esc = html.escape
    lines = ['<section class="slide cover">']
    if audience:
        lines.append(f'  <p class="muted">{esc(audience)}</p>')
    lines.append(f"  <h1>{esc(title)}</h1>")
    first = purpose.splitlines()[0].strip() if purpose else ""
    if first:
        lines.append(f"  <p>{esc(first)}</p>")
    byline = ". ".join(x for x in (presenter, time.strftime("%Y-%m-%d")) if x)
    lines.append(f'  <p class="muted">{esc(byline)}</p>')
    lines.append("</section>")
    return "\n".join(lines) + "\n"


def _brief_md(title: str, presenter: str, purpose: str, audience: str, sources: str) -> str:
    def block(heading: str, text: str) -> list[str]:
        return [f"## {heading}", "", text if text else "(not given)", ""]

    out = [f"# {title}", "", f"Created {time.strftime('%Y-%m-%d')} with HTML Studio's new deck wizard.", ""]
    if presenter:
        out += ["Presenter: " + presenter, ""]
    out += block("Purpose", purpose)
    out += block("Audience", audience)
    out += block("Source material", sources)
    out += ["## Working notes", "", "Slides live in slides/ (one section per file, ordered by file name). Speaker notes go to notes/<slide>.md.", ""]
    return "\n".join(out)


def _design_md(title: str, accent: str, bg: str, fg: str, font: str) -> str:
    q = lambda s: f'"{s}"'  # noqa: E731
    lines = ["---", "colors:", f"  primary: {q(accent)}", f"  secondary: {q(accent)}", f"  canvas: {q(bg)}", f"  ink: {q(fg)}",
             f"  ink-muted: {q(_mix(fg, bg, 0.55))}", f"  hairline: {q(_mix(fg, bg, 0.15))}", f"  on-secondary: {q(bg)}"]
    if font:
        lines += ["typography:", "  body:", f"    fontFamily: {q(font)}"]
    lines += ["---", "", f"# {title} design", "", "Three colours and a font chosen in the new deck wizard. Edit this file and regenerate tokens.css from the studio.", ""]
    return "\n".join(lines)


def _mix(a: str, b: str, t: float) -> str:
    """Blend hex colour ``a`` toward ``b`` by ``t`` (0 = a, 1 = b)."""
    ra, ga, ba = (int(a[i:i + 2], 16) for i in (1, 3, 5))
    rb, gb, bb = (int(b[i:i + 2], 16) for i in (1, 3, 5))
    mix = lambda x, y: round(x + (y - x) * t)  # noqa: E731
    return f"#{mix(ra, rb):02x}{mix(ga, gb):02x}{mix(ba, bb):02x}"


def _apply_theme(deck: Path, title: str, theme: dict[str, Any], copy_from: Path | None) -> str | None:
    """Write theme files; returns the css path to record in studio.json (or None)."""
    kind = theme.get("kind") if isinstance(theme, dict) else "default"
    if kind in (None, "", "default"):
        return None
    if kind == "design":
        colours = {k: str(theme.get(k) or "").strip().lower() for k in ("accent", "bg", "fg")}
        for k, v in colours.items():
            if not _HEX_RE.match(v):
                raise NewDeckError("bad_colour")
        font = str(theme.get("font") or "").strip()[:80]
        (deck / design_lib.DESIGN_FILE).write_text(_design_md(title, colours["accent"], colours["bg"], colours["fg"], font), encoding="utf-8")
        d = design_lib.read_design(deck)
        if d is None or d.empty:
            raise NewDeckError("design_failed")
        design_lib.write_tokens(deck, d)
        return design_lib.TOKENS_FILE
    if kind == "copy":
        if copy_from is None:
            raise NewDeckError("bad_theme_source")
        studio = deck_lib._read_studio(copy_from) or {}
        css_rel = studio.get("css") if isinstance(studio.get("css"), str) and studio.get("css", "").strip() else None
        copied_css: str | None = None
        for rel in [r for r in (css_rel, design_lib.TOKENS_FILE, design_lib.DESIGN_FILE, "theme.css", "style.css", "styles.css", "deck.css") if r]:
            src = copy_from / rel
            try:
                src.resolve().relative_to(copy_from.resolve())
            except ValueError:
                continue
            if src.is_file():
                dst = deck / rel
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)
                if copied_css is None and rel.endswith(".css"):
                    copied_css = rel
        if copied_css is None:
            raise NewDeckError("no_theme_to_copy")
        return copied_css
    raise NewDeckError("bad_theme")


def create_deck(root: Path, folder: str, answers: dict[str, Any], theme: dict[str, Any], copy_from: Path | None = None) -> Path:
    """Create the deck and return its folder. Raises NewDeckError; leaves nothing behind on failure."""
    folder = validate_folder(folder)
    title = _field(answers, "title", required=True)
    presenter = _field(answers, "presenter")
    purpose = _field(answers, "purpose")
    audience = _field(answers, "audience")
    sources = _field(answers, "sources")
    deck = root / folder
    if deck.exists():
        raise NewDeckError("exists")
    deck.mkdir(parents=True)
    try:
        (deck / "slides").mkdir()
        (deck / "slides" / "010_cover.html").write_text(_cover_html(title, presenter, purpose, audience), encoding="utf-8")
        (deck / "slides" / "020_agenda.html").write_text(layouts_lib.read_layout(deck, "agenda"), encoding="utf-8")
        (deck / "brief.md").write_text(_brief_md(title, presenter, purpose, audience, sources), encoding="utf-8")
        css = _apply_theme(deck, title, theme, copy_from)
        studio: dict[str, Any] = {"slidesDir": "slides", "title": title}
        if css:
            studio["css"] = css
        for k, v in (("presenter", presenter), ("purpose", purpose), ("audience", audience)):
            if v:
                studio[k] = v
        (deck / deck_lib.STUDIO_FILE).write_text(json.dumps(studio, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except Exception:
        shutil.rmtree(deck, ignore_errors=True)
        raise
    return deck
