"""Deck roots and deck discovery.

A *deck root* is a user-chosen folder the app scans for decks. A *deck* is a
folder that either carries a ``studio.json`` or has a ``slides/`` folder with at
least one ``.html`` file (one file per slide).

Roots are persisted in ``<data_dir>/config.json`` under ``"roots"``. Only
folders inside the user's home directory are accepted, and symlinks that
escape the home directory are refused.
"""
from __future__ import annotations

import json
import re
import os
from pathlib import Path
from typing import Any

SCAN_DEPTH = 2
MAX_DECKS = 200
DEFAULT_SLIDES_DIR = "slides"
STUDIO_FILE = "studio.json"
_SKIP_DIRS = {"node_modules", "__pycache__", "dist", "build", "out"}


class RootError(ValueError):
    """A root path was rejected; ``code`` is a stable machine-readable reason."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


# ------------------------------------------------------------------- config
def _config_path(data_dir: Path) -> Path:
    return data_dir / "config.json"


def load_config(data_dir: Path) -> dict[str, Any]:
    try:
        data = json.loads(_config_path(data_dir).read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def save_config(data_dir: Path, config: dict[str, Any]) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    tmp = _config_path(data_dir).with_suffix(".json.tmp")
    tmp.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, _config_path(data_dir))


def list_roots(data_dir: Path) -> list[str]:
    roots = load_config(data_dir).get("roots", [])
    return [r for r in roots if isinstance(r, str)]


def validate_root(raw: str, *, home: Path | None = None) -> Path:
    """Return the resolved root path or raise :class:`RootError`."""
    home = (home or Path.home()).resolve()
    text = (raw or "").strip()
    if not text:
        raise RootError("empty_path", "path is empty")
    path = Path(os.path.expanduser(text))
    if not path.is_absolute():
        raise RootError("relative_path", "path must be absolute")
    if not path.exists():
        raise RootError("not_found", "folder does not exist")
    if not path.is_dir():
        raise RootError("not_a_directory", "path is not a folder")
    resolved = path.resolve()
    if resolved != home and home not in resolved.parents:
        raise RootError("outside_home", "folder must be inside your home directory")
    return resolved


def add_root(data_dir: Path, raw: str, *, home: Path | None = None) -> list[str]:
    root = str(validate_root(raw, home=home))
    config = load_config(data_dir)
    roots = [r for r in config.get("roots", []) if isinstance(r, str)]
    if root not in roots:
        roots.append(root)
    config["roots"] = roots
    save_config(data_dir, config)
    return roots


def remove_root(data_dir: Path, raw: str) -> list[str]:
    config = load_config(data_dir)
    roots = [r for r in config.get("roots", []) if isinstance(r, str) and r != raw]
    config["roots"] = roots
    save_config(data_dir, config)
    return roots


# -------------------------------------------------------------------- decks
def _read_studio(deck_dir: Path) -> dict[str, Any] | None:
    path = deck_dir / STUDIO_FILE
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def _slide_files(slides_dir: Path) -> list[Path]:
    if not slides_dir.is_dir():
        return []
    return sorted(p for p in slides_dir.iterdir() if p.is_file() and p.suffix.lower() == ".html")


_SECTION_CLASS_RE = re.compile(r"""<section\b[^>]*\bclass=(["'])(.*?)\1""", re.I | re.S)


def _count_slide_sections(text: str) -> int:
    return sum(1 for m in _SECTION_CLASS_RE.finditer(text) if "slide" in m.group(2).split())


def single_file_entry(deck_dir: Path) -> tuple[Path, int] | None:
    """Return (entry_html, slide_count) when *deck_dir* holds a built single-file deck.

    A single-file deck is an ``index.html`` (else the only ``*.html`` at the deck
    root) containing at least two ``<section class="... slide ...">`` blocks.
    """
    candidates = [deck_dir / "index.html"] if (deck_dir / "index.html").is_file() else sorted(
        p for p in deck_dir.glob("*.html") if p.is_file()
    )
    if not candidates or len(candidates) > 1 and candidates[0].name != "index.html":
        return None
    entry = candidates[0]
    try:
        if entry.stat().st_size > 20 * 1024 * 1024:
            return None
        text = entry.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None
    count = _count_slide_sections(text)
    return (entry, count) if count >= 2 else None


def describe_deck(deck_dir: Path, root: Path) -> dict[str, Any] | None:
    """Return deck metadata if *deck_dir* is a deck, else None."""
    studio = _read_studio(deck_dir)
    slides_dir_name = DEFAULT_SLIDES_DIR
    if studio and isinstance(studio.get("slidesDir"), str) and studio["slidesDir"].strip():
        slides_dir_name = studio["slidesDir"].strip()
    slides_dir = (deck_dir / slides_dir_name)
    # Refuse a slidesDir that escapes the deck folder.
    try:
        slides_dir.resolve().relative_to(deck_dir.resolve())
    except ValueError:
        slides_dir = deck_dir / DEFAULT_SLIDES_DIR
        slides_dir_name = DEFAULT_SLIDES_DIR
    slides = _slide_files(slides_dir)
    kind = "slides"
    entry: str | None = None
    slide_names = [p.name for p in slides]
    mtimes = [p.stat().st_mtime for p in slides] + [deck_dir.stat().st_mtime]
    if studio is None and not slides:
        single = single_file_entry(deck_dir)
        if single is None:
            return None
        entry_path, count = single
        kind, entry = "single", entry_path.name
        slide_names = [f"{entry}#{i + 1}" for i in range(count)]
        mtimes.append(entry_path.stat().st_mtime)
    return {
        "id": str(deck_dir),
        "name": deck_dir.name,
        "path": str(deck_dir),
        "root": str(root),
        "kind": kind,
        "entry": entry,
        "slidesDir": slides_dir_name,
        "slideCount": len(slide_names),
        "slides": slide_names,
        "hasStudioJson": studio is not None,
        "hasDesignMd": (deck_dir / "DESIGN.md").is_file(),
        "modifiedAt": max(mtimes),
    }


def _iter_dirs(root: Path, depth: int):
    """Yield *root* and its subfolders up to *depth* levels, skipping noise."""
    yield root
    if depth <= 0:
        return
    try:
        children = sorted(root.iterdir())
    except OSError:
        return
    for child in children:
        if not child.is_dir() or child.is_symlink():
            continue
        if child.name.startswith(".") or child.name in _SKIP_DIRS:
            continue
        yield from _iter_dirs(child, depth - 1)


def scan_decks(roots: list[str], *, depth: int = SCAN_DEPTH, limit: int = MAX_DECKS) -> list[dict[str, Any]]:
    decks: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in roots:
        root = Path(raw)
        if not root.is_dir():
            continue
        for folder in _iter_dirs(root, depth):
            if len(decks) >= limit:
                return decks
            key = str(folder.resolve())
            if key in seen:
                continue
            deck = describe_deck(folder, root)
            if deck:
                seen.add(key)
                decks.append(deck)
    decks.sort(key=lambda d: d["modifiedAt"], reverse=True)
    return decks
