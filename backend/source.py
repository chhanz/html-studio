"""Slide source for the code editor: read one slide's HTML and write it back.

Two deck shapes:

* split deck: the slide IS a file (``slides/NNN.html``); the whole file is edited.
* single-file deck: the slide is one top-level ``<section class="slide">`` of the
  entry document; only that section's text is shown and, on save, spliced back
  in place. Everything else in the document stays byte for byte.

Writes carry the mtime the editor loaded, so a file changed meanwhile (by the
agent, or another editor) is not overwritten silently: ``Conflict`` is raised
and the UI asks whether to reload or overwrite.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import preview as preview_lib

MAX_TEXT = 2_000_000


class SourceError(Exception):
    def __init__(self, code: str, detail: str = "") -> None:
        super().__init__(detail or code)
        self.code = code


class Conflict(SourceError):
    """The file on disk is not the one the editor loaded."""

    def __init__(self, mtime: float) -> None:
        super().__init__("conflict", "file changed on disk")
        self.mtime = mtime


def _mtime(path: Path) -> float:
    return round(os.stat(path).st_mtime, 3)


def _section_spans(document: str) -> list[tuple[int, int]]:
    """(start, end) of each slide section, in the order the deck shows them."""
    return [m.span() for m in preview_lib._SECTION_RE.finditer(document) if preview_lib._is_slide_section(m.group(0))]


def _locate(deck: Path, slides_dir: str, entry: str | None, slide: str) -> tuple[Path, int | None]:
    """(file, section index or None) for a slide display name; raises SourceError."""
    if entry:
        base, _, num = slide.partition("#")
        if base != entry or not num.isdigit():
            raise SourceError("unknown_slide")
        return deck / entry, int(num) - 1
    if "/" in slide or "\\" in slide or slide in ("", ".", "..") or not slide.lower().endswith(".html"):
        raise SourceError("unknown_slide")
    path = deck / slides_dir / slide
    if not path.is_file():
        raise SourceError("unknown_slide")
    return path, None


def read_source(deck: Path, slides_dir: str, entry: str | None, slide: str) -> dict[str, Any]:
    path, idx = _locate(deck, slides_dir, entry, slide)
    text = path.read_text(encoding="utf-8", errors="replace")
    mtime = _mtime(path)
    if idx is None:
        return {"slide": slide, "file": path.relative_to(deck).as_posix(), "kind": "file", "text": text, "mtime": mtime}
    spans = _section_spans(text)
    if idx < 0 or idx >= len(spans):
        raise SourceError("unknown_slide")
    a, b = spans[idx]
    return {"slide": slide, "file": path.relative_to(deck).as_posix(), "kind": "section", "text": text[a:b], "mtime": mtime}


def write_source(
    deck: Path, slides_dir: str, entry: str | None, slide: str, text: str, expected_mtime: float | None,
) -> dict[str, Any]:
    """Write the slide's source. ``expected_mtime`` None skips the conflict check (overwrite)."""
    if len(text) > MAX_TEXT:
        raise SourceError("too_large")
    path, idx = _locate(deck, slides_dir, entry, slide)
    current = _mtime(path)
    if expected_mtime is not None and abs(current - expected_mtime) > 0.0015:
        raise Conflict(current)
    if idx is None:
        new_doc = text
    else:
        doc = path.read_text(encoding="utf-8", errors="replace")
        spans = _section_spans(doc)
        if idx < 0 or idx >= len(spans):
            raise SourceError("unknown_slide")
        # The replacement must still be exactly one slide section, or the deck
        # would gain or lose slides behind the editor's back.
        if len(_section_spans(text)) != 1:
            raise SourceError("not_one_section")
        a, b = spans[idx]
        new_doc = doc[:a] + text + doc[b:]
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(new_doc, encoding="utf-8")
    os.replace(tmp, path)
    return {"slide": slide, "file": path.relative_to(deck).as_posix(), "mtime": _mtime(path)}
