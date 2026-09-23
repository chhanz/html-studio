"""Tests for arrange.py: reorder / add / duplicate / archive / restore, notes follow."""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import arrange  # noqa: E402


def _split_deck(tmp: str) -> Path:
    deck = Path(tmp)
    (deck / "slides").mkdir()
    for n in ("010_cover", "020_agenda", "030_uptime", "040_roadmap"):
        (deck / "slides" / f"{n}.html").write_text(f"<section class='slide'>{n}</section>")
    (deck / "notes").mkdir()
    (deck / "notes" / "020_agenda.md").write_text("agenda note\n")
    (deck / "notes" / "040_roadmap.md").write_text("roadmap note\n")
    return deck


def _names(deck: Path) -> list[str]:
    return [p.name for p in arrange._slide_files(deck, "slides")]


class SplitDeckTests(unittest.TestCase):
    def test_reorder_renumbers_and_moves_notes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = _split_deck(tmp)
            new = arrange.reorder(deck, "slides", None, ["010_cover.html", "030_uptime.html", "040_roadmap.html", "020_agenda.html"])
            self.assertEqual(new, ["010_cover.html", "020_uptime.html", "030_roadmap.html", "040_agenda.html"])
            self.assertEqual(_names(deck), new)
            self.assertEqual((deck / "slides" / "040_agenda.html").read_text(), "<section class='slide'>020_agenda</section>")
            self.assertEqual((deck / "notes" / "040_agenda.md").read_text(), "agenda note\n")
            self.assertEqual((deck / "notes" / "030_roadmap.md").read_text(), "roadmap note\n")
            self.assertFalse((deck / "notes" / "020_agenda.md").exists())
            self.assertEqual([p.name for p in (deck / "slides").iterdir() if p.name.startswith(".")], [])
            with self.assertRaises(arrange.ArrangeError):
                arrange.reorder(deck, "slides", None, ["010_cover.html"])  # not a permutation

    def test_add_duplicate_archive_restore(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = _split_deck(tmp)
            name = arrange.add(deck, "slides", None, "020_agenda.html")
            self.assertEqual(name, "030_new.html")
            self.assertEqual(_names(deck), ["010_cover.html", "020_agenda.html", "030_new.html", "040_uptime.html", "050_roadmap.html"])
            self.assertIn("<h2>New slide</h2>", (deck / "slides" / "030_new.html").read_text())
            self.assertEqual((deck / "notes" / "050_roadmap.md").read_text(), "roadmap note\n")
            dup = arrange.add(deck, "slides", None, "020_agenda.html", duplicate=True)
            self.assertEqual(dup, "030_agenda-copy.html")
            self.assertEqual((deck / "slides" / dup).read_text(), "<section class='slide'>020_agenda</section>")
            self.assertEqual(_names(deck)[3], "040_new.html")
            # Append at the end when after is None.
            self.assertEqual(arrange.add(deck, "slides", None, None), "070_new.html")
            # Archive moves the file and its note; the rest is renumbered? No: names stay, order is unchanged.
            gone = arrange.archive(deck, "slides", None, "020_agenda.html")
            self.assertEqual(gone, {"name": "020_agenda.html", "file": "archive/020_agenda.html"})
            self.assertTrue((deck / "archive" / "020_agenda.html").is_file())
            self.assertTrue((deck / "archive" / "020_agenda.md").is_file())
            self.assertNotIn("020_agenda.html", _names(deck))
            self.assertEqual([a["name"] for a in arrange.list_archive(deck)], ["020_agenda.html"])
            self.assertTrue(arrange.list_archive(deck)[0]["hasNote"])
            # Restore after the cover: numbered into place, note back.
            back = arrange.restore(deck, "slides", None, "020_agenda.html", "010_cover.html")
            self.assertEqual(back, "020_agenda.html")
            self.assertEqual(_names(deck)[:3], ["010_cover.html", "020_agenda.html", "030_agenda-copy.html"])
            self.assertEqual((deck / "notes" / "020_agenda.md").read_text(), "agenda note\n")
            self.assertEqual(arrange.list_archive(deck), [])
            with self.assertRaises(arrange.ArrangeError):
                arrange.restore(deck, "slides", None, "../secret.html", None)

    def test_last_slide_cannot_be_archived(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp)
            (deck / "slides").mkdir()
            (deck / "slides" / "010_only.html").write_text("<section class='slide'>x</section>")
            with self.assertRaises(arrange.ArrangeError) as ctx:
                arrange.archive(deck, "slides", None, "010_only.html")
            self.assertEqual(ctx.exception.code, "last_slide")


SINGLE = """<!doctype html><html><body>
<section class="slide" id="a">A</section>
<section class="slide" id="b">B</section>
<section class="slide" id="c">C</section>
</body></html>"""


class SingleFileTests(unittest.TestCase):
    def test_reorder_add_archive_restore_with_notes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp)
            (deck / "index.html").write_text(SINGLE)
            (deck / "notes").mkdir()
            (deck / "notes" / "index-1.md").write_text("note A\n")
            (deck / "notes" / "index-3.md").write_text("note C\n")
            arrange.reorder(deck, "slides", "index.html", ["index.html#3", "index.html#1", "index.html#2"])
            doc = (deck / "index.html").read_text()
            self.assertEqual([m for m in ("C", "A", "B")], [doc[a:b][-len("</section>") - 1] for a, b in arrange._sections(doc)])
            self.assertEqual((deck / "notes" / "index-1.md").read_text(), "note C\n")
            self.assertEqual((deck / "notes" / "index-2.md").read_text(), "note A\n")
            self.assertFalse((deck / "notes" / "index-3.md").exists())
            # Add after #1: the new section is #2, notes shift.
            self.assertEqual(arrange.add(deck, "slides", "index.html", "index.html#1"), "index.html#2")
            self.assertEqual(len(arrange._sections((deck / "index.html").read_text())), 4)
            self.assertEqual((deck / "notes" / "index-3.md").read_text(), "note A\n")
            # Archive #1 (C): the block leaves the document, its note becomes a dated orphan.
            gone = arrange.archive(deck, "slides", "index.html", "index.html#1")
            self.assertTrue(gone["name"].startswith("index-1-") and gone["name"].endswith(".html"))
            self.assertEqual((deck / "archive" / gone["name"]).read_text().strip(), '<section class="slide" id="c">C</section>')
            doc = (deck / "index.html").read_text()
            self.assertEqual(len(arrange._sections(doc)), 3)
            self.assertNotIn('id="c"', doc)
            self.assertEqual((deck / "notes" / "index-2.md").read_text(), "note A\n")
            orphans = [p.name for p in (deck / "notes").iterdir() if "archived" in p.name]
            self.assertEqual(len(orphans), 1)
            # Restore it at the end.
            self.assertEqual(arrange.restore(deck, "slides", "index.html", gone["name"], None), "index.html#4")
            self.assertIn('id="c"', (deck / "index.html").read_text())
            self.assertEqual(arrange.list_archive(deck), [])


if __name__ == "__main__":
    unittest.main()
