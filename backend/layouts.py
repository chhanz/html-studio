"""Layout library: slide templates to insert, built in or saved by the user.

Built-in layouts live next to this file in ``layouts/<id>.html`` and only use
the default theme's classes (``cover``, ``divider``, ``muted``, ``accent``) so
they render acceptably under any deck stylesheet. User layouts are saved from
a slide into the app's data folder (``<data>/layouts/<id>.html`` with a
``<id>.json`` sidecar for the name) and are available in every deck; they keep
whatever deck-relative paths the slide had, so images may need fixing elsewhere.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any

BUILTIN_DIR = Path(__file__).resolve().parent / "layouts"
BUILTIN_ORDER = ["blank", "cover", "agenda", "divider", "two-column", "table", "kpi", "image-caption"]
USER_PREFIX = "my-"
MAX_USER = 100
MAX_TEXT = 500_000

_SLUG_RE = re.compile(r"[^a-z0-9]+")


class LayoutError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def user_dir(data_dir: Path) -> Path:
    return data_dir / "layouts"


def _slug(name: str) -> str:
    s = _SLUG_RE.sub("-", name.lower()).strip("-")
    return s[:40] or "layout"


def list_layouts(data_dir: Path) -> list[dict[str, Any]]:
    """Built-ins first (fixed order), then the user's, newest first."""
    out: list[dict[str, Any]] = []
    for lid in BUILTIN_ORDER:
        if (BUILTIN_DIR / f"{lid}.html").is_file():
            out.append({"id": lid, "name": None, "builtin": True})
    mine = user_dir(data_dir)
    if mine.is_dir():
        items = []
        for p in mine.glob(f"{USER_PREFIX}*.html"):
            meta = p.with_suffix(".json")
            name = p.stem[len(USER_PREFIX):]
            created = p.stat().st_mtime
            if meta.is_file():
                try:
                    m = json.loads(meta.read_text(encoding="utf-8"))
                    name = str(m.get("name") or name)
                    created = float(m.get("created") or created)
                except (ValueError, OSError):
                    pass
            items.append({"id": p.stem, "name": name, "builtin": False, "created": created})
        items.sort(key=lambda x: x["created"], reverse=True)
        out.extend(items)
    return out


def read_layout(data_dir: Path, layout_id: str) -> str:
    """The slide HTML for a layout id; raises LayoutError('unknown_layout')."""
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", layout_id or ""):
        raise LayoutError("unknown_layout")
    p = user_dir(data_dir) / f"{layout_id}.html" if layout_id.startswith(USER_PREFIX) else BUILTIN_DIR / f"{layout_id}.html"
    if not p.is_file():
        raise LayoutError("unknown_layout")
    return p.read_text(encoding="utf-8", errors="replace")


def save_layout(data_dir: Path, name: str, html: str) -> dict[str, Any]:
    """Store ``html`` as a user layout called ``name``. Returns its list entry."""
    name = (name or "").strip()
    if not name or len(name) > 60:
        raise LayoutError("bad_name")
    if not html.strip() or len(html) > MAX_TEXT:
        raise LayoutError("bad_html")
    d = user_dir(data_dir)
    d.mkdir(parents=True, exist_ok=True)
    if len(list(d.glob(f"{USER_PREFIX}*.html"))) >= MAX_USER:
        raise LayoutError("too_many")
    base = USER_PREFIX + _slug(name)
    lid, n = base, 2
    while (d / f"{lid}.html").exists():
        lid = f"{base}-{n}"
        n += 1
    created = time.time()
    (d / f"{lid}.html").write_text(html.rstrip("\n") + "\n", encoding="utf-8")
    (d / f"{lid}.json").write_text(json.dumps({"name": name, "created": created}), encoding="utf-8")
    return {"id": lid, "name": name, "builtin": False, "created": created}


def delete_layout(data_dir: Path, layout_id: str) -> None:
    """Remove a user layout; built-ins cannot be deleted."""
    if not layout_id.startswith(USER_PREFIX) or not re.fullmatch(r"[a-z0-9-]+", layout_id):
        raise LayoutError("unknown_layout")
    p = user_dir(data_dir) / f"{layout_id}.html"
    if not p.is_file():
        raise LayoutError("unknown_layout")
    p.unlink()
    meta = p.with_suffix(".json")
    if meta.is_file():
        meta.unlink()
