"""Tests for source.py: slide source read/write, section splice, mtime guard."""
from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import source  # noqa: E402

SINGLE = """<!doctype html><html><head><style>.slide{}</style></head><body>
<section class="slide" id="a"><h1>A</h1></section>
<section class="slide" id="b"><h1>B</h1></section>
<section class="notslide">x</section>
<section class="slide" id="c"><h1>C</h1></section>
</body></html>"""


class SourceTests(unittest.TestCase):
    def test_split_deck_read_write_and_conflict(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp)
            (deck / "slides").mkdir()
            f = deck / "slides" / "010.html"
            f.write_text("<section class='slide'>one</section>")
            got = source.read_source(deck, "slides", None, "010.html")
            self.assertEqual((got["kind"], got["file"], got["text"]), ("file", "slides/010.html", "<section class='slide'>one</section>"))
            saved = source.write_source(deck, "slides", None, "010.html", "<section class='slide'>ONE</section>", got["mtime"])
            self.assertEqual(f.read_text(), "<section class='slide'>ONE</section>")
            self.assertFalse((deck / "slides" / "010.html.tmp").exists())
            # Someone else changes the file: a save with the old mtime is refused.
            os.utime(f, (f.stat().st_atime, f.stat().st_mtime + 5))
            with self.assertRaises(source.Conflict) as ctx:
                source.write_source(deck, "slides", None, "010.html", "x", saved["mtime"])
            self.assertGreater(ctx.exception.mtime, saved["mtime"])
            # Overwrite (no mtime) always goes through.
            source.write_source(deck, "slides", None, "010.html", "<section class='slide'>forced</section>", None)
            self.assertEqual(f.read_text(), "<section class='slide'>forced</section>")
            for bad in ("../010.html", "nope.html", "notes/010.md", ""):
                with self.assertRaises(source.SourceError):
                    source.read_source(deck, "slides", None, bad)

    def test_single_file_section_splice(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp)
            (deck / "index.html").write_text(SINGLE)
            got = source.read_source(deck, "slides", "index.html", "index.html#2")
            self.assertEqual((got["kind"], got["text"]), ("section", '<section class="slide" id="b"><h1>B</h1></section>'))
            # The third slide is the third SLIDE section (the non-slide section is skipped).
            self.assertEqual(source.read_source(deck, "slides", "index.html", "index.html#3")["text"], '<section class="slide" id="c"><h1>C</h1></section>')
            source.write_source(deck, "slides", "index.html", "index.html#2", '<section class="slide" id="b"><h1>Bee</h1>\n<p>more</p></section>', got["mtime"])
            doc = (deck / "index.html").read_text()
            self.assertIn('<h1>Bee</h1>\n<p>more</p></section>\n<section class="notslide">', doc)
            self.assertTrue(doc.startswith("<!doctype html><html><head><style>.slide{}</style>"))
            self.assertEqual(len(source._section_spans(doc)), 3)
            # The replacement must stay exactly one slide section.
            m = source.read_source(deck, "slides", "index.html", "index.html#1")["mtime"]
            for bad in ("<p>no section</p>", '<section class="slide">1</section><section class="slide">2</section>'):
                with self.assertRaises(source.SourceError) as ctx:
                    source.write_source(deck, "slides", "index.html", "index.html#1", bad, m)
                self.assertEqual(ctx.exception.code, "not_one_section")
            with self.assertRaises(source.SourceError):
                source.read_source(deck, "slides", "index.html", "index.html#9")
            with self.assertRaises(source.SourceError):
                source.read_source(deck, "slides", "index.html", "other.html#1")


if __name__ == "__main__":
    unittest.main()
