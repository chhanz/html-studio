"""Tweak panel: adjust a deck's theme variables and write them back.

What can be tweaked is what the deck declares: with a DESIGN.md, its colours,
font, type sizes, spacing and radii (each becomes one control, keyed by the
CSS variable tokens.css emits). Without one, the default theme's hooks
(``--hs-accent`` ...) are offered instead.

Live preview never touches files: the studio posts the current overrides to
the preview server, which prints them as a ``<style>`` block in every wrapped
slide page (strip, viewer, presenter alike). Apply writes the values into the
DESIGN.md front matter (creating the file for a deck that had none, in the
same shape the new deck wizard uses) and regenerates tokens.css.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import decks as deck_lib
import design as design_lib

_HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
_LEN_RE = re.compile(r"^(-?\d+(?:\.\d+)?)(px|rem|em|%|vw|vh)?$")
_VAR_RE = re.compile(r"^--[a-z0-9-]+$")
MAX_CHANGES = 200

# Default theme hooks offered when a deck has no DESIGN.md (name -> (kind, default)).
DEFAULT_HOOKS: list[tuple[str, str, str]] = [
    ("--hs-accent", "color", "#6d5efc"),
    ("--hs-bg", "color", "#ffffff"),
    ("--hs-fg", "color", "#1f2430"),
    ("--hs-muted", "color", "#6b7280"),
    ("--hs-border", "color", "#e5e7eb"),
    ("--hs-cover", "color", "#1e1b4b"),
]
# Which DESIGN.md colour names the default-hook controls map to when a file is created.
HOOK_TO_COLOR = {"--hs-accent": "primary", "--hs-bg": "canvas", "--hs-fg": "ink", "--hs-muted": "ink-muted", "--hs-border": "hairline", "--hs-cover": "secondary"}


class TweakError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _kind_of(value: str) -> str:
    v = value.strip()
    if _HEX_RE.match(v):
        return "color"
    if _LEN_RE.match(v):
        return "length"
    return "text"


def describe(deck: Path) -> dict[str, Any]:
    """Controls for the panel: [{var, group, name, kind, value}], plus whether DESIGN.md exists."""
    d = design_lib.read_design(deck)
    items: list[dict[str, Any]] = []
    if d is None or d.empty:
        for var, kind, default in DEFAULT_HOOKS:
            items.append({"var": var, "group": "colors", "name": var[len("--hs-"):], "kind": kind, "value": default})
        items.append({"var": "--hs-font", "group": "font", "name": "family", "kind": "text", "value": ""})
        return {"hasDesign": d is not None, "items": items, "css": _deck_css_rel(deck) or _own_css(deck)}
    for name, value in d.colors.items():
        items.append({"var": design_lib._var_name("color", name), "group": "colors", "name": name, "kind": "color", "value": value})
    if d.font_family or d.font_fallback:
        items.append({"var": "--font-sans", "group": "font", "name": "family", "kind": "text", "value": d.font_family or ""})
    for name, style in d.typography.items():
        base = design_lib._var_name("type", name)
        if style.size:
            items.append({"var": f"{base}-size", "group": "typography", "name": f"{name} size", "kind": _kind_of(style.size), "value": style.size})
    for name, value in d.spacing.items():
        items.append({"var": design_lib._var_name("space", name), "group": "spacing", "name": name, "kind": _kind_of(value), "value": value})
    for name, value in d.rounded.items():
        items.append({"var": design_lib._var_name("radius", name), "group": "rounded", "name": name, "kind": _kind_of(value), "value": value})
    css = _deck_css_rel(deck) or _own_css(deck)
    return {"hasDesign": True, "items": items, "css": css, "layered": bool(css and css != design_lib.TOKENS_FILE and (deck / design_lib.TOKENS_FILE).is_file())}


OWN_CSS_CANDIDATES = ("assets/deck.css", "out/assets/deck.css", "deck.css")


def _own_css(deck: Path) -> str | None:
    """A stylesheet the deck ships itself (the server's candidate list, minus tokens.css)."""
    for rel in OWN_CSS_CANDIDATES:
        if (deck / rel).is_file():
            return rel
    return None


def _deck_css_rel(deck: Path) -> str | None:
    studio = deck_lib._read_studio(deck) or {}
    css = studio.get("css")
    return css.strip() if isinstance(css, str) and css.strip() else None


def validate_changes(changes: Any) -> dict[str, str]:
    """{var: value} with safe names and values (hex, length, or a short plain string)."""
    if not isinstance(changes, dict) or len(changes) > MAX_CHANGES:
        raise TweakError("bad_changes")
    out: dict[str, str] = {}
    for var, value in changes.items():
        if not isinstance(var, str) or not _VAR_RE.match(var) or not isinstance(value, str):
            raise TweakError("bad_changes")
        v = value.strip()
        if len(v) > 120 or any(ch in v for ch in ";{}<>\\"):
            raise TweakError("bad_changes")
        out[var] = v
    return out


def overrides_css(changes: dict[str, str]) -> str:
    """A ``<style>``-ready rule that wins over tokens.css and the default theme."""
    if not changes:
        return ""
    body = "".join(f"{var}:{value}!important;" for var, value in changes.items())
    return f":root{{{body}}}"


# --- apply -------------------------------------------------------------------
def _fm_set(front: str, path: list[str], value: str) -> str:
    """Set ``path`` (e.g. ['colors', 'primary']) in the simple-YAML front matter, adding lines when missing."""
    lines = front.splitlines()
    q = f'"{value}"'
    # Find the section line and its indent.
    sec_idx = next((i for i, ln in enumerate(lines) if ln.strip() == f"{path[0]}:"), None)
    if len(path) == 1:
        if sec_idx is not None:
            lines[sec_idx] = f"{path[0]}: {q}"
        else:
            lines.append(f"{path[0]}: {q}")
        return "\n".join(lines)
    if sec_idx is None:
        lines.append(f"{path[0]}:")
        sec_idx = len(lines) - 1
    indent = 2
    # Section body: following lines with greater indent.
    end = sec_idx + 1
    while end < len(lines) and (not lines[end].strip() or len(lines[end]) - len(lines[end].lstrip(" ")) > 0):
        end += 1
    body = lines[sec_idx + 1:end]
    if body:
        indent = min(len(ln) - len(ln.lstrip(" ")) for ln in body if ln.strip()) or 2
    if len(path) == 2:
        key = path[1]
        for j in range(sec_idx + 1, end):
            k, _, _ = lines[j].strip().partition(":")
            if k.strip().strip('"').strip("'") == key and len(lines[j]) - len(lines[j].lstrip(" ")) == indent:
                lines[j] = " " * indent + f"{key}: {q}"
                return "\n".join(lines)
        lines.insert(end, " " * indent + f"{key}: {q}")
        return "\n".join(lines)
    # depth 3: typography.<name>.<field>
    name, field = path[1], path[2]
    for j in range(sec_idx + 1, end):
        if lines[j].strip() == f"{name}:" and len(lines[j]) - len(lines[j].lstrip(" ")) == indent:
            k = j + 1
            while k < end and len(lines[k]) - len(lines[k].lstrip(" ")) > indent:
                fk, _, _ = lines[k].strip().partition(":")
                if fk.strip() == field:
                    lines[k] = " " * (indent * 2) + f"{field}: {q}"
                    return "\n".join(lines)
                k += 1
            lines.insert(k, " " * (indent * 2) + f"{field}: {q}")
            return "\n".join(lines)
    lines.insert(end, " " * indent + f"{name}:")
    lines.insert(end + 1, " " * (indent * 2) + f"{field}: {q}")
    return "\n".join(lines)


def _var_to_path(var: str, d: design_lib.Design) -> list[str] | None:
    """Map a tokens.css variable back to its DESIGN.md front-matter path."""
    for name in d.colors:
        if design_lib._var_name("color", name) == var:
            return ["colors", name]
    if var == "--font-sans":
        # font lives under typography.<first name>.fontFamily, or body
        first = next(iter(d.typography), "body")
        return ["typography", first, "fontFamily"]
    for name, style in d.typography.items():
        if f"{design_lib._var_name('type', name)}-size" == var:
            return ["typography", name, "fontSize"]
    for name in d.spacing:
        if design_lib._var_name("space", name) == var:
            return ["spacing", name]
    for name in d.rounded:
        if design_lib._var_name("radius", name) == var:
            return ["rounded", name]
    return None


def _fix_prose_hex(body: str, name: str, old: str, new: str) -> str:
    """When the colour is also stated in prose/tables next to its name, update that hex too."""
    if not old or old.lower() == new.lower():
        return body
    pattern = re.compile(rf"(\b{re.escape(name)}\b[^\n]*?){re.escape(old)}", re.I)
    return pattern.sub(lambda m: m.group(1) + new, body)


def apply(deck: Path, changes: dict[str, str]) -> dict[str, Any]:
    """Write ``changes`` into DESIGN.md (front matter) and regenerate tokens.css.

    Returns {"design": <as_dict>, "created": bool, "css": "tokens.css"}.
    """
    if not changes:
        raise TweakError("no_changes")
    path = deck / design_lib.DESIGN_FILE
    d = design_lib.read_design(deck)
    created = False
    if d is None or d.empty:
        # Build a DESIGN.md from the default hooks, then apply on top.
        colors = {HOOK_TO_COLOR[var]: default for var, _, default in DEFAULT_HOOKS}
        colors["on-secondary"] = "#ffffff"
        lines = ["---", "colors:"] + [f'  {k}: "{v}"' for k, v in colors.items()] + ["---", "", f"# {deck.name} design", "", "Created by the HTML Studio tweak panel. Edit and regenerate tokens.css from the studio.", ""]
        path.write_text("\n".join(lines), encoding="utf-8")
        d = design_lib.read_design(deck)
        created = True
        # Translate hook variables to token variables for the pass below.
        changes = {(design_lib._var_name("color", HOOK_TO_COLOR[v]) if v in HOOK_TO_COLOR else ("--font-sans" if v == "--hs-font" else v)): val for v, val in changes.items()}
    assert d is not None
    text = path.read_text(encoding="utf-8")
    front, body = design_lib._split_front_matter(text)
    had_front = text.startswith("---")
    unknown = []
    for var, value in changes.items():
        p = _var_to_path(var, d)
        if p is None:
            unknown.append(var)
            continue
        if p[0] == "colors":
            if not _HEX_RE.match(value):
                raise TweakError("bad_colour")
            body = _fix_prose_hex(body, p[1], d.colors.get(p[1], ""), value.lower())
            value = value.lower()
        front = _fm_set(front, p, value)
    new_text = "---" + (front if front.startswith("\n") else "\n" + front) + ("\n" if not front.endswith("\n") else "") + "---" + (body if had_front else "\n" + body)
    path.write_text(new_text, encoding="utf-8")
    d2 = design_lib.read_design(deck)
    if d2 is None or d2.empty:
        raise TweakError("design_failed")
    design_lib.write_tokens(deck, d2)
    # A deck with its own stylesheet keeps it: tokens.css is served underneath as a
    # variables layer (preview and built-in build both link it first). Only a deck
    # with no stylesheet at all gets tokens.css as its css.
    if _deck_css_rel(deck) is None and not _own_css(deck):
        studio_path = deck / deck_lib.STUDIO_FILE
        studio = deck_lib._read_studio(deck) or {}
        studio.setdefault("slidesDir", "slides")
        studio["css"] = design_lib.TOKENS_FILE
        studio_path.write_text(json.dumps(studio, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"design": d2.as_dict(), "created": created, "css": design_lib.TOKENS_FILE, "unknown": unknown}
