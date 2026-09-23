"""DESIGN.md reader and tokens.css writer.

A deck may carry a ``DESIGN.md`` in the Stitch / getdesign.md format: prose and
tables that reference tokens such as ``{colors.primary}`` and state their values
inline (``#0075de``, ``12px``), optionally preceded by a YAML front matter with
the same tokens. This module turns that into a small structured design record
and, on request, into a ``tokens.css`` of CSS custom properties:

    --color-<name>, --font-sans, --space-<name>, --radius-<name>,
    --type-<name>-size / -weight / -leading / -tracking

plus a handful of ``--hs-*`` hooks the studio's default theme reads, so a deck
without its own stylesheet is rendered in its DESIGN.md colours right away.

Only the standard library is used (no YAML dependency): the front-matter parser
understands the indentation-based mappings these files actually use.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

TOKENS_FILE = "tokens.css"
DESIGN_FILE = "DESIGN.md"

_TOKEN_RE = re.compile(r"\{(colors|typography|spacing|rounded)\.([A-Za-z0-9_-]+)\}")
_HEX_RE = re.compile(r"#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b")
_PX_RE = re.compile(r"(-?\d+(?:\.\d+)?)px\b")
_CODE_RE = re.compile(r"`([^`]+)`")
_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*$")


@dataclass
class TypeStyle:
    size: str | None = None
    weight: str | None = None
    line_height: str | None = None
    letter_spacing: str | None = None

    def as_dict(self) -> dict[str, str | None]:
        return {"size": self.size, "weight": self.weight, "lineHeight": self.line_height, "letterSpacing": self.letter_spacing}


@dataclass
class Design:
    name: str | None = None
    colors: dict[str, str] = field(default_factory=dict)
    typography: dict[str, TypeStyle] = field(default_factory=dict)
    spacing: dict[str, str] = field(default_factory=dict)
    rounded: dict[str, str] = field(default_factory=dict)
    font_family: str | None = None
    font_fallback: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "colors": dict(self.colors),
            "typography": {k: v.as_dict() for k, v in self.typography.items()},
            "spacing": dict(self.spacing),
            "rounded": dict(self.rounded),
            "font": {"family": self.font_family, "fallback": self.font_fallback},
        }

    @property
    def empty(self) -> bool:
        return not (self.colors or self.typography or self.spacing or self.rounded or self.font_family)


# --- front matter ---------------------------------------------------------
def _split_front_matter(text: str) -> tuple[str, str]:
    """Return (front_matter, body). Front matter is the leading ``---`` block."""
    if not text.startswith("---"):
        return "", text
    end = re.search(r"^---\s*$", text[3:], re.M)
    if not end:
        return "", text
    return text[3 : 3 + end.start()], text[3 + end.end() :]


def _parse_simple_yaml(src: str) -> dict[str, Any]:
    """Indentation-based mappings of scalars (what DESIGN.md front matter uses).

    Lists and multi-line scalars are ignored. Good enough for token blocks; the
    prose pass fills anything this misses.
    """
    root: dict[str, Any] = {}
    stack: list[tuple[int, dict[str, Any]]] = [(-1, root)]
    for raw in src.splitlines():
        if not raw.strip() or raw.lstrip().startswith("#") or raw.lstrip().startswith("-"):
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        line = raw.strip()
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip().strip('"').strip("'")
        value = value.strip()
        while stack and indent <= stack[-1][0]:
            stack.pop()
        parent = stack[-1][1] if stack else root
        if value == "":
            child: dict[str, Any] = {}
            parent[key] = child
            stack.append((indent, child))
        else:
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            parent[key] = value
    return root


def _from_front_matter(data: dict[str, Any], design: Design) -> None:
    for name, value in (data.get("colors") or {}).items() if isinstance(data.get("colors"), dict) else []:
        if isinstance(value, str) and _HEX_RE.fullmatch(value.strip()):
            design.colors[str(name)] = value.strip().lower()
    for section, target in (("spacing", design.spacing), ("rounded", design.rounded)):
        block = data.get(section)
        if isinstance(block, dict):
            for name, value in block.items():
                if isinstance(value, str) and value.strip():
                    target[str(name)] = value.strip()
    typo = data.get("typography")
    if isinstance(typo, dict):
        for name, value in typo.items():
            if not isinstance(value, dict):
                continue
            style = design.typography.setdefault(str(name), TypeStyle())
            style.size = value.get("fontSize") or value.get("size") or style.size
            style.weight = str(value.get("fontWeight") or value.get("weight") or style.weight or "") or None
            style.line_height = str(value.get("lineHeight") or style.line_height or "") or None
            style.letter_spacing = value.get("letterSpacing") or style.letter_spacing
            fam = value.get("fontFamily")
            if fam and not design.font_family:
                design.font_family = str(fam).split(",")[0].strip().strip("'\"")


# --- prose / tables -------------------------------------------------------
_CHAIN_SEP_RE = re.compile(r"[\s/,&()`*]*")


def _value_after(line: str, start: int, pattern: re.Pattern[str]) -> str | None:
    """First ``pattern`` match after ``start`` with no other token in between.

    Tokens chained with only separators between them (``{colors.canvas}`` /
    ``{colors.surface}`` -- #ffffff) share the value that follows the chain.
    """
    pos = start
    while True:
        nxt = _TOKEN_RE.search(line, pos)
        if nxt and _CHAIN_SEP_RE.fullmatch(line, pos, nxt.start()):
            pos = nxt.end()
            continue
        break
    limit = nxt.start() if nxt else len(line)
    m = pattern.search(line, pos, limit)
    return m.group(0) if m else None


def _value_before(line: str, end: int, pattern: re.Pattern[str]) -> str | None:
    """Last ``pattern`` match before ``end`` with no other token in between."""
    prev_tokens = [m for m in _TOKEN_RE.finditer(line, 0, end)]
    lo = prev_tokens[-1].end() if prev_tokens else 0
    ms = list(pattern.finditer(line, lo, end))
    return ms[-1].group(0) if ms else None


def _table_cells(line: str) -> list[str] | None:
    s = line.strip()
    if not (s.startswith("|") and s.endswith("|")):
        return None
    cells = [c.strip() for c in s.strip("|").split("|")]
    if all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
        return None  # separator row
    return cells


def _norm_minus(s: str) -> str:
    return s.replace("\u2212", "-").replace("\u2013", "-")


def _from_prose(body: str, design: Design) -> None:
    section = ""
    for line in body.splitlines():
        h = _HEADING_RE.match(line)
        if h:
            section = h.group(2).strip().lower()
            if h.group(1) == "#" and not design.name:
                design.name = h.group(2).strip()
            continue
        cells = _table_cells(line)
        if cells:
            _from_table_row(cells, design)
            # a table row can still carry inline tokens (e.g. rounded usage); fall through
        for m in _TOKEN_RE.finditer(line):
            kind, name = m.group(1), m.group(2)
            if kind == "colors":
                if name in design.colors:
                    continue
                hexv = _value_after(line, m.end(), _HEX_RE)
                if hexv:
                    design.colors[name] = hexv.lower()
            elif kind in ("spacing", "rounded"):
                target = design.spacing if kind == "spacing" else design.rounded
                if name in target or cells:
                    continue
                px = _value_after(line, m.end(), _PX_RE) or _value_before(line, m.start(), _PX_RE)
                if px:
                    target[name] = px
        if "font family" in section or "font" == section:
            for code in _CODE_RE.findall(line):
                code = code.strip()
                if "," in code and not design.font_fallback:
                    design.font_fallback = code
                elif "," not in code and not design.font_family and not _TOKEN_RE.search(code) and len(code) < 60:
                    design.font_family = code
    if design.font_family is None:
        m = re.search(r"set in \*\*`?([A-Za-z0-9 _-]{2,40})`?\*\*", body)
        if m:
            design.font_family = m.group(1)


def _from_table_row(cells: list[str], design: Design) -> None:
    if not cells:
        return
    tok = _TOKEN_RE.search(cells[0])
    if not tok:
        return
    kind, name = tok.group(1), tok.group(2)
    # Tables are the authoritative statement of a token; they override prose.
    if kind == "typography" and len(cells) >= 5:
        style = design.typography.setdefault(name, TypeStyle())
        size, weight, lh, ls = (cells[1], cells[2], cells[3], cells[4])
        style.size = size if _PX_RE.search(size) else style.size
        style.weight = weight if re.fullmatch(r"\d{3}|[a-z]+", weight) else style.weight
        style.line_height = lh if re.fullmatch(r"\d+(\.\d+)?(px|%)?", lh) else style.line_height
        ls = _norm_minus(ls)
        style.letter_spacing = ls.lstrip("+") if re.fullmatch(r"[+-]?\d+(\.\d+)?(px|em)", ls) else style.letter_spacing
    elif kind in ("rounded", "spacing") and len(cells) >= 2:
        target = design.rounded if kind == "rounded" else design.spacing
        px = _PX_RE.search(cells[1])
        if px:
            target[name] = px.group(0)


def parse_design_md(text: str) -> Design:
    design = Design()
    front, body = _split_front_matter(text)
    if front:
        try:
            _from_front_matter(_parse_simple_yaml(front), design)
        except Exception:  # noqa: BLE001 - front matter is best-effort
            pass
    _from_prose(body, design)
    return design


def read_design(deck: Path) -> Design | None:
    path = deck / DESIGN_FILE
    if not path.is_file():
        return None
    return parse_design_md(path.read_text(encoding="utf-8", errors="replace"))


# --- tokens.css -----------------------------------------------------------
_SAFE_NAME_RE = re.compile(r"[^a-z0-9-]+")


def _var_name(prefix: str, name: str) -> str:
    return f"--{prefix}-{_SAFE_NAME_RE.sub('-', name.lower()).strip('-')}"


def _first(colors: dict[str, str], *names: str) -> str | None:
    for n in names:
        if n in colors:
            return n
    return None


def tokens_css(design: Design) -> str:
    """CSS custom properties for the design, plus the studio's theme hooks."""
    lines = [
        "/* Generated by HTML Studio from DESIGN.md. Re-generate instead of editing. */",
        ":root {",
    ]
    for name, value in design.colors.items():
        lines.append(f"  {_var_name('color', name)}: {value};")
    if design.font_family or design.font_fallback:
        fam = design.font_family
        stack = ", ".join(p for p in ([f'"{fam}"' if fam and " " in fam else fam] if fam else []) + ([design.font_fallback] if design.font_fallback else []) if p)
        lines.append(f"  --font-sans: {stack};")
    for name, value in design.spacing.items():
        lines.append(f"  {_var_name('space', name)}: {value};")
    for name, value in design.rounded.items():
        lines.append(f"  {_var_name('radius', name)}: {value};")
    for name, style in design.typography.items():
        base = _var_name("type", name)
        if style.size:
            lines.append(f"  {base}-size: {style.size};")
        if style.weight:
            lines.append(f"  {base}-weight: {style.weight};")
        if style.line_height:
            lines.append(f"  {base}-leading: {style.line_height};")
        if style.letter_spacing:
            lines.append(f"  {base}-tracking: {style.letter_spacing};")
    hooks = []
    c = design.colors
    accent = _first(c, "primary", "accent", "brand")
    bg = _first(c, "canvas-soft", "canvas", "background", "surface", "bg")
    fg = _first(c, "ink", "text", "foreground", "on-surface", "on-background")
    muted = _first(c, "ink-muted", "muted", "text-muted", "ink-secondary", "secondary-text")
    border = _first(c, "hairline", "border", "outline", "divider")
    if accent:
        hooks.append(f"  --hs-accent: var({_var_name('color', accent)});")
    if bg:
        hooks.append(f"  --hs-bg: var({_var_name('color', bg)});")
    if fg:
        hooks.append(f"  --hs-fg: var({_var_name('color', fg)});")
    if muted:
        hooks.append(f"  --hs-muted: var({_var_name('color', muted)});")
    if border:
        hooks.append(f"  --hs-border: var({_var_name('color', border)});")
    cover = _first(c, "secondary", "primary-dark", "night", "inverse")
    if cover:
        hooks.append(f"  --hs-cover: var({_var_name('color', cover)});")
        on_cover = _first(c, "on-secondary", "on-primary", "surface", "canvas")
        if on_cover:
            hooks.append(f"  --hs-on-cover: var({_var_name('color', on_cover)});")
    if design.font_family or design.font_fallback:
        hooks.append("  --hs-font: var(--font-sans);")
    if hooks:
        lines.append("  /* Hooks read by HTML Studio's default theme */")
        lines.extend(hooks)
    lines.append("}")
    return "\n".join(lines) + "\n"


def write_tokens(deck: Path, design: Design) -> Path:
    out = deck / TOKENS_FILE
    out.write_text(tokens_css(design), encoding="utf-8")
    return out
