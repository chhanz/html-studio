"""Slide arrangement: reorder, add, duplicate, archive and restore.

Split decks (``slides/NNN_name.html``): order is the file name order, so a
reorder renumbers the prefixes (10, 20, 30 ...) and renames only the files
whose number changes; the part after the prefix is kept. Archiving MOVES the
file into ``archive/`` (never deletes); restoring moves it back with a fresh
number. Speaker notes (``notes/<slide>.md``) follow their slide.

Single-file decks (one ``index.html``): the same operations splice the slide
``<section>`` blocks inside the entry document; an archived section becomes
``archive/<entry>-<n>-<stamp>.html``. Notes are keyed by position
(``index-3.md``) there, so they are renumbered to follow the sections.

Names are always chosen here, never taken from the client.
"""
from __future__ import annotations

import os
import re
import time
from pathlib import Path
from typing import Any

import notes as notes_lib
import preview as preview_lib

ARCHIVE_DIR = "archive"
STEP = 10
NEW_SLIDE = '<section class="slide">\n  <h2>New slide</h2>\n  <p>Text goes here.</p>\n</section>\n'

_PREFIX_RE = re.compile(r"^(\d+)([_\-. ]?)(.*)$")
STAGE = ".hs-stage-"  # a file waiting for its number in _rename_all


class ArrangeError(Exception):
    def __init__(self, code: str, detail: str = "") -> None:
        super().__init__(detail or code)
        self.code = code


# --- helpers -----------------------------------------------------------------
def _slide_files(deck: Path, slides_dir: str) -> list[Path]:
    d = deck / slides_dir
    if not d.is_dir():
        return []
    return sorted(p for p in d.iterdir() if p.is_file() and p.suffix.lower() == ".html")


def _stem_after_prefix(name: str) -> str:
    """'020_agenda.html' -> 'agenda.html'; 'intro.html' -> 'intro.html'; a staged name -> its stem."""
    if name.startswith(STAGE):
        return name[len(STAGE):]
    m = _PREFIX_RE.match(name)
    rest = m.group(3) if m and m.group(3) else name
    return rest or name


def _numbered(n: int, rest: str) -> str:
    width = 3 if n < 1000 else len(str(n))
    return f"{n:0{width}d}_{rest}"


def _move_note(deck: Path, old: str, new: str) -> None:
    if old == new:
        return
    src = notes_lib.note_path(deck, old)
    if src.is_file():
        dst = notes_lib.note_path(deck, new)
        dst.parent.mkdir(parents=True, exist_ok=True)
        os.replace(src, dst)


def _rename_all(deck: Path, slides_dir: str, ordered: list[str]) -> list[str]:
    """Renumber ``ordered`` (current file names, in the wanted order); returns the new names.

    Two passes through temporary names, so a swap never overwrites a file.
    """
    d = deck / slides_dir
    targets = [_numbered((i + 1) * STEP, _stem_after_prefix(n)) for i, n in enumerate(ordered)]
    if len(set(targets)) != len(targets):
        # Two slides share the same stem: fall back to the full old name after the number.
        targets = [_numbered((i + 1) * STEP, n if targets.count(t) > 1 else _stem_after_prefix(n)) for i, (n, t) in enumerate(zip(ordered, targets))]
    changes = [(o, n) for o, n in zip(ordered, targets) if o != n]
    if not changes:
        return targets
    tmp = {o: f".hs-tmp-{i}-{o}" for i, (o, _) in enumerate(changes)}
    for o, _ in changes:
        os.replace(d / o, d / tmp[o])
        _move_note(deck, o, tmp[o])
    for o, n in changes:
        os.replace(d / tmp[o], d / n)
        _move_note(deck, tmp[o], n)
    return targets


def _sections(doc: str) -> list[tuple[int, int]]:
    return [m.span() for m in preview_lib._SECTION_RE.finditer(doc) if preview_lib._is_slide_section(m.group(0))]


def _renumber_single_notes(deck: Path, entry: str, mapping: list[int | None], old_count: int) -> None:
    """``mapping[new_index] = old_index`` (None = a new slide). Notes follow their slide;
    a note whose slide was archived stays behind as an orphan with a dated name."""
    stash: dict[int, Path] = {}
    for i in range(old_count):
        p = notes_lib.note_path(deck, f"{entry}#{i + 1}")
        if p.is_file():
            t = p.with_name(f".hs-tmp-{i}.md")
            os.replace(p, t)
            stash[i] = t
    for new_i, old_i in enumerate(mapping):
        if old_i is not None and old_i in stash:
            os.replace(stash.pop(old_i), notes_lib.note_path(deck, f"{entry}#{new_i + 1}"))
    for i, t in stash.items():
        os.replace(t, t.with_name(f"{Path(entry).stem}-{i + 1}-archived-{_stamp()}.md"))


def _write(path: Path, text: str) -> None:
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def _stamp() -> str:
    return time.strftime("%Y%m%d-%H%M%S")


# --- operations --------------------------------------------------------------
def reorder(deck: Path, slides_dir: str, entry: str | None, order: list[str]) -> list[str]:
    """Put the slides in ``order`` (current display names, a permutation). Returns the new names."""
    if entry:
        path = deck / entry
        doc = path.read_text(encoding="utf-8", errors="replace")
        spans = _sections(doc)
        want = [f"{entry}#{i + 1}" for i in range(len(spans))]
        if sorted(order) != sorted(want):
            raise ArrangeError("bad_order")
        idx = [int(o.rpartition("#")[2]) - 1 for o in order]
        blocks = [doc[a:b] for a, b in spans]
        out, pos = [], 0
        for k, (a, b) in enumerate(spans):
            out.append(doc[pos:a])
            out.append(blocks[idx[k]])
            pos = b
        out.append(doc[pos:])
        _write(path, "".join(out))
        _renumber_single_notes(deck, entry, idx, len(spans))
        return want
    names = [p.name for p in _slide_files(deck, slides_dir)]
    if sorted(order) != sorted(names) or len(set(order)) != len(order):
        raise ArrangeError("bad_order")
    return _rename_all(deck, slides_dir, order)


def add(deck: Path, slides_dir: str, entry: str | None, after: str | None, duplicate: bool = False, content: str | None = None, stem: str | None = None) -> str:
    """Insert a new slide after ``after`` (None = at the end). ``duplicate`` copies ``after``;
    otherwise ``content`` (a layout) or the blank slide is used, named ``stem`` (default 'new'). Returns its name."""
    if content is not None and len(_sections(content)) != 1:
        raise ArrangeError("not_one_section")
    if entry:
        path = deck / entry
        doc = path.read_text(encoding="utf-8", errors="replace")
        spans = _sections(doc)
        pos_idx = len(spans) - 1 if after is None else int(after.rpartition("#")[2]) - 1
        if after is not None and not (0 <= pos_idx < len(spans)):
            raise ArrangeError("unknown_slide")
        if not spans:
            raise ArrangeError("no_sections")
        a, b = spans[pos_idx]
        block = doc[a:b] if duplicate else (content if content is not None else NEW_SLIDE).strip("\n")
        _write(path, doc[:b] + "\n" + block + doc[b:])
        mapping: list[int | None] = list(range(pos_idx + 1)) + [None] + list(range(pos_idx + 1, len(spans)))
        _renumber_single_notes(deck, entry, mapping, len(spans))
        return f"{entry}#{pos_idx + 2}"
    files = _slide_files(deck, slides_dir)
    names = [p.name for p in files]
    if after is not None and after not in names:
        raise ArrangeError("unknown_slide")
    pos = len(names) if after is None else names.index(after) + 1
    if duplicate and after:
        content = (deck / slides_dir / after).read_text(encoding="utf-8", errors="replace")
        rest = _stem_after_prefix(after).replace(".html", "-copy.html")
    else:
        content = content if content is not None else NEW_SLIDE
        rest = f"{re.sub(r'[^a-z0-9-]+', '-', (stem or 'new').lower()).strip('-') or 'new'}.html"
    (deck / slides_dir).mkdir(parents=True, exist_ok=True)
    staged = STAGE + rest
    _write(deck / slides_dir / staged, content)
    ordered = names[:pos] + [staged] + names[pos:]
    return _rename_all(deck, slides_dir, ordered)[pos]


def archive(deck: Path, slides_dir: str, entry: str | None, slide: str) -> dict[str, Any]:
    """Move a slide out of the deck into archive/ (with its note). Returns {name, file}."""
    arch = deck / ARCHIVE_DIR
    if entry:
        path = deck / entry
        doc = path.read_text(encoding="utf-8", errors="replace")
        spans = _sections(doc)
        if len(spans) <= 1:
            raise ArrangeError("last_slide")
        idx = int(slide.rpartition("#")[2]) - 1 if slide.startswith(f"{entry}#") else -1
        if not (0 <= idx < len(spans)):
            raise ArrangeError("unknown_slide")
        a, b = spans[idx]
        arch.mkdir(exist_ok=True)
        name = f"{Path(entry).stem}-{idx + 1}-{_stamp()}.html"
        _write(arch / name, doc[a:b].strip() + "\n")
        # Drop the block and one adjacent newline so the document does not gain blank lines.
        cut_a = a - 1 if a > 0 and doc[a - 1] == "\n" else a
        _write(path, doc[:cut_a] + doc[b:])
        mapping: list[int | None] = [i for i in range(len(spans)) if i != idx]
        _renumber_single_notes(deck, entry, mapping, len(spans))
        return {"name": name, "file": f"{ARCHIVE_DIR}/{name}"}
    files = _slide_files(deck, slides_dir)
    names = [p.name for p in files]
    if slide not in names:
        raise ArrangeError("unknown_slide")
    if len(names) <= 1:
        raise ArrangeError("last_slide")
    arch.mkdir(exist_ok=True)
    target = arch / slide
    if target.exists():
        target = arch / f"{Path(slide).stem}-{_stamp()}.html"
    os.replace(deck / slides_dir / slide, target)
    note = notes_lib.note_path(deck, slide)
    if note.is_file():
        os.replace(note, arch / note.name if not (arch / note.name).exists() else arch / f"{note.stem}-{_stamp()}.md")
    return {"name": target.name, "file": f"{ARCHIVE_DIR}/{target.name}"}


def list_archive(deck: Path) -> list[dict[str, Any]]:
    arch = deck / ARCHIVE_DIR
    if not arch.is_dir():
        return []
    out = []
    for p in sorted(arch.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if p.is_file() and p.suffix.lower() == ".html":
            out.append({"name": p.name, "file": f"{ARCHIVE_DIR}/{p.name}", "mtime": round(p.stat().st_mtime, 3), "hasNote": (arch / (p.stem + ".md")).is_file()})
    return out


def restore(deck: Path, slides_dir: str, entry: str | None, name: str, after: str | None) -> str:
    """Bring an archived slide back after ``after`` (None = end). Returns its new display name."""
    if "/" in name or "\\" in name or not name.lower().endswith(".html"):
        raise ArrangeError("unknown_archive")
    src = deck / ARCHIVE_DIR / name
    if not src.is_file():
        raise ArrangeError("unknown_archive")
    if entry:
        path = deck / entry
        doc = path.read_text(encoding="utf-8", errors="replace")
        spans = _sections(doc)
        block = src.read_text(encoding="utf-8", errors="replace").strip()
        if len(_sections(block)) != 1:
            raise ArrangeError("not_one_section")
        pos_idx = len(spans) - 1 if after is None else int(after.rpartition("#")[2]) - 1
        if not spans or not (0 <= pos_idx < len(spans)):
            raise ArrangeError("unknown_slide")
        _, b = spans[pos_idx]
        _write(path, doc[:b] + "\n" + block + doc[b:])
        src.unlink()
        mapping: list[int | None] = list(range(pos_idx + 1)) + [None] + list(range(pos_idx + 1, len(spans)))
        _renumber_single_notes(deck, entry, mapping, len(spans))
        return f"{entry}#{pos_idx + 2}"
    names = [p.name for p in _slide_files(deck, slides_dir)]
    if after is not None and after not in names:
        raise ArrangeError("unknown_slide")
    pos = len(names) if after is None else names.index(after) + 1
    staged = STAGE + _stem_after_prefix(name)
    os.replace(src, deck / slides_dir / staged)
    note = deck / ARCHIVE_DIR / (Path(name).stem + ".md")
    if note.is_file():
        os.replace(note, notes_lib.note_path(deck, staged))
    ordered = names[:pos] + [staged] + names[pos:]
    return _rename_all(deck, slides_dir, ordered)[pos]
