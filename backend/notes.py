"""Speaker notes: Markdown sidecar files, one per slide, under ``<deck>/notes/``.

The note for ``slides/030_uptime.html`` is ``notes/030_uptime.md``; for a
single-file deck the sections are ``index.html#3`` and the note is
``notes/index-3.md``. Notes never enter slide HTML, the build output or the
PDF: they are for the presenter view only.

An "orphan" is a note whose slide no longer exists (renamed or archived slide).
It is reported, never deleted here.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

NOTES_DIR = "notes"
_SAFE_RE = re.compile(r"[^A-Za-z0-9._-]+")


def note_name(slide_name: str) -> str:
    """``030_uptime.html`` -> ``030_uptime.md``; ``index.html#3`` -> ``index-3.md``."""
    base = re.sub(r"\.html?(?=#|$)", "", slide_name, flags=re.I).replace("#", "-")
    return _SAFE_RE.sub("_", base) + ".md"


def note_path(deck: Path, slide_name: str) -> Path:
    return deck / NOTES_DIR / note_name(slide_name)


def read_note(deck: Path, slide_name: str) -> str:
    p = note_path(deck, slide_name)
    try:
        return p.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""


def write_note(deck: Path, slide_name: str, text: str) -> Path:
    """Write the note; an empty text removes the file so no empty sidecars accumulate."""
    p = note_path(deck, slide_name)
    if text.strip() == "":
        try:
            p.unlink()
        except FileNotFoundError:
            pass
        return p
    p.parent.mkdir(parents=True, exist_ok=True)
    if not text.endswith("\n"):
        text += "\n"
    p.write_text(text, encoding="utf-8")
    return p


def list_notes(deck: Path, slide_names: list[str]) -> dict[str, Any]:
    """Which slides have notes, and which notes have no slide (orphans)."""
    expected = {note_name(s): s for s in slide_names}
    have: list[str] = []
    orphans: list[str] = []
    d = deck / NOTES_DIR
    if d.is_dir():
        for f in sorted(d.glob("*.md")):
            if f.name in expected:
                have.append(expected[f.name])
            else:
                orphans.append(f.name)
    return {"withNotes": have, "orphans": orphans, "dir": NOTES_DIR}
