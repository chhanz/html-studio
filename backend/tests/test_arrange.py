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
            # Only the moved slide is renamed: the others keep their numbers.
            new = arrange.reorder(deck, "slides", None, ["010_cover.html", "030_uptime.html", "040_roadmap.html", "020_agenda.html"])
            self.assertEqual(new, ["010_cover.html", "030_uptime.html", "040_roadmap.html", "050_agenda.html"])
            self.assertEqual(_names(deck), new)
            self.assertEqual((deck / "slides" / "050_agenda.html").read_text(), "<section class='slide'>020_agenda</section>")
            self.assertEqual((deck / "notes" / "050_agenda.md").read_text(), "agenda note\n")
            self.assertEqual((deck / "notes" / "040_roadmap.md").read_text(), "roadmap note\n")
            self.assertFalse((deck / "notes" / "020_agenda.md").exists())
            # A swap of neighbours with room between them renames one file into the gap.
            new = arrange.reorder(deck, "slides", None, ["010_cover.html", "040_roadmap.html", "030_uptime.html", "050_agenda.html"])
            self.assertEqual(new, ["010_cover.html", "040_roadmap.html", "045_uptime.html", "050_agenda.html"])
            # Gappy, hand-picked numbering survives an unrelated move (real decks: 000/005/010 ... 990).
            for n in list((deck / "slides").iterdir()):
                n.unlink()
            for n in ("000_cover", "005_agenda", "010_div", "470_cost", "480_cost", "990_closing"):
                (deck / "slides" / f"{n}.html").write_text("<section class='slide'>x</section>")
            new = arrange.reorder(deck, "slides", None, ["000_cover.html", "005_agenda.html", "010_div.html", "480_cost.html", "470_cost.html", "990_closing.html"])
            self.assertEqual(new, ["000_cover.html", "005_agenda.html", "010_div.html", "480_cost.html", "735_cost.html", "990_closing.html"])
            self.assertEqual(new[:3] + new[5:], ["000_cover.html", "005_agenda.html", "010_div.html", "990_closing.html"])
            self.assertEqual([p.name for p in (deck / "slides").iterdir() if p.name.startswith(".")], [])
            with self.assertRaises(arrange.ArrangeError):
                arrange.reorder(deck, "slides", None, ["010_cover.html"])  # not a permutation

    def test_dash_convention_is_kept(self) -> None:
        """A deck named 01-cover / 02-agenda keeps its separator through a swap and an insert."""
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp)
            (deck / "slides").mkdir()
            for n in ("01-cover", "02-agenda", "05-coverage", "12-close"):
                (deck / "slides" / f"{n}.html").write_text("<section class='slide'>x</section>")
            new = arrange.reorder(deck, "slides", None, ["01-cover.html", "05-coverage.html", "02-agenda.html", "12-close.html"])
            self.assertEqual(new, ["01-cover.html", "05-coverage.html", "08-agenda.html", "12-close.html"])
            name = arrange.add(deck, "slides", None, after="01-cover.html", content="<section class='slide'>new</section>")
            self.assertEqual(name, "03-new.html")
            self.assertEqual(_names(deck), ["01-cover.html", "03-new.html", "05-coverage.html", "08-agenda.html", "12-close.html"])

    def test_add_duplicate_archive_restore(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = _split_deck(tmp)
            # A new slide takes a free number between its neighbours; nothing else is renamed.
            name = arrange.add(deck, "slides", None, "020_agenda.html")
            self.assertEqual(name, "025_new.html")
            self.assertEqual(_names(deck), ["010_cover.html", "020_agenda.html", "025_new.html", "030_uptime.html", "040_roadmap.html"])
            self.assertIn("<h2>New slide</h2>", (deck / "slides" / "025_new.html").read_text())
            self.assertEqual((deck / "notes" / "040_roadmap.md").read_text(), "roadmap note\n")
            dup = arrange.add(deck, "slides", None, "020_agenda.html", duplicate=True)
            self.assertEqual(dup, "022_agenda-copy.html")
            self.assertEqual((deck / "slides" / dup).read_text(), "<section class='slide'>020_agenda</section>")
            self.assertEqual(_names(deck)[3], "025_new.html")
            # Append at the end when after is None: last number + 10.
            self.assertEqual(arrange.add(deck, "slides", None, None), "050_new.html")
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
            self.assertEqual(back, "016_agenda.html")
            self.assertEqual(_names(deck)[:3], ["010_cover.html", "016_agenda.html", "022_agenda-copy.html"])
            self.assertEqual((deck / "notes" / "016_agenda.md").read_text(), "agenda note\n")
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
