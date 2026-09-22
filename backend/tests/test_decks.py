"""Unit tests for backend/decks.py.

Run:  python3 -m unittest backend/tests/test_decks.py
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import decks  # noqa: E402


def make_deck(folder: Path, slides: int = 2, studio: dict | None = None, slides_dir: str = "slides") -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    if slides:
        (folder / slides_dir).mkdir(parents=True, exist_ok=True)
        for i in range(slides):
            (folder / slides_dir / f"{(i + 1) * 10:03d}_slide.html").write_text("<section class='slide'></section>")
    if studio is not None:
        (folder / "studio.json").write_text(json.dumps(studio))
    return folder


class RootTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name) / "home"
        self.home.mkdir()
        self.data = Path(self.tmp.name) / "data"

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_add_and_persist(self) -> None:
        target = self.home / "decks"
        target.mkdir()
        roots = decks.add_root(self.data, str(target), home=self.home)
        self.assertEqual(roots, [str(target.resolve())])
        self.assertEqual(decks.list_roots(self.data), roots)
        # idempotent
        self.assertEqual(decks.add_root(self.data, str(target), home=self.home), roots)

    def test_remove(self) -> None:
        target = self.home / "decks"
        target.mkdir()
        decks.add_root(self.data, str(target), home=self.home)
        self.assertEqual(decks.remove_root(self.data, str(target.resolve())), [])

    def test_rejects_outside_home(self) -> None:
        outside = Path(self.tmp.name) / "elsewhere"
        outside.mkdir()
        with self.assertRaises(decks.RootError) as ctx:
            decks.validate_root(str(outside), home=self.home)
        self.assertEqual(ctx.exception.code, "outside_home")

    def test_rejects_symlink_escape(self) -> None:
        outside = Path(self.tmp.name) / "elsewhere"
        outside.mkdir()
        link = self.home / "link"
        os.symlink(outside, link)
        with self.assertRaises(decks.RootError) as ctx:
            decks.validate_root(str(link), home=self.home)
        self.assertEqual(ctx.exception.code, "outside_home")

    def test_rejects_missing_relative_file(self) -> None:
        for raw, code in [("", "empty_path"), ("relative/dir", "relative_path"),
                          (str(self.home / "nope"), "not_found")]:
            with self.assertRaises(decks.RootError) as ctx:
                decks.validate_root(raw, home=self.home)
            self.assertEqual(ctx.exception.code, code)
        f = self.home / "file.txt"
        f.write_text("x")
        with self.assertRaises(decks.RootError) as ctx:
            decks.validate_root(str(f), home=self.home)
        self.assertEqual(ctx.exception.code, "not_a_directory")

    def test_accepts_home_itself(self) -> None:
        self.assertEqual(decks.validate_root(str(self.home), home=self.home), self.home.resolve())


class ScanTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "root"
        self.root.mkdir()

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_finds_slides_and_studio_decks(self) -> None:
        make_deck(self.root / "a", slides=3)
        make_deck(self.root / "group" / "b", slides=0, studio={"slidesDir": "pages"})
        make_deck(self.root / "group" / "c", slides=1, studio={"slidesDir": "pages"}, slides_dir="pages")
        (self.root / "plain").mkdir()
        found = {d["name"]: d for d in decks.scan_decks([str(self.root)])}
        self.assertEqual(set(found), {"a", "b", "c"})
        self.assertEqual(found["a"]["slideCount"], 3)
        self.assertEqual(found["a"]["slides"], ["010_slide.html", "020_slide.html", "030_slide.html"])
        self.assertEqual(found["b"]["slideCount"], 0)
        self.assertTrue(found["b"]["hasStudioJson"])
        self.assertEqual(found["c"]["slidesDir"], "pages")
        self.assertEqual(found["c"]["slideCount"], 1)

    def test_respects_depth_and_skips_noise(self) -> None:
        make_deck(self.root / "l1" / "l2" / "too-deep", slides=1)
        make_deck(self.root / "node_modules" / "x", slides=1)
        make_deck(self.root / ".hidden" / "y", slides=1)
        make_deck(self.root / "ok", slides=1)
        names = [d["name"] for d in decks.scan_decks([str(self.root)])]
        self.assertEqual(names, ["ok"])

    def test_slides_dir_escape_falls_back(self) -> None:
        make_deck(self.root / "evil", slides=1, studio={"slidesDir": "../../etc"})
        d = decks.scan_decks([str(self.root)])[0]
        self.assertEqual(d["slidesDir"], "slides")

    def test_missing_root_ignored(self) -> None:
        self.assertEqual(decks.scan_decks([str(self.root / "gone")]), [])

    def test_limit(self) -> None:
        for i in range(5):
            make_deck(self.root / f"d{i}", slides=1)
        self.assertEqual(len(decks.scan_decks([str(self.root)], limit=3)), 3)

    def test_single_file_deck(self) -> None:
        d = self.root / "built"
        d.mkdir()
        (d / "index.html").write_text(
            "<html><head><link rel='stylesheet' href='assets/deck.css'></head><body>"
            "<section class='slide cover active'>a</section><section class='slide'>b</section>"
            "<section class='slide'>c</section></body></html>"
        )
        (self.root / "page").mkdir()
        (self.root / "page" / "index.html").write_text("<html><body><section class='slide'>only one</section></body></html>")
        found = {x["name"]: x for x in decks.scan_decks([str(self.root)])}
        self.assertIn("built", found)
        self.assertNotIn("page", found)  # one section is a web page, not a deck
        b = found["built"]
        self.assertEqual((b["kind"], b["entry"], b["slideCount"]), ("single", "index.html", 3))
        self.assertEqual(b["slides"], ["index.html#1", "index.html#2", "index.html#3"])

    def test_slides_dir_wins_over_single_file(self) -> None:
        d = make_deck(self.root / "both", slides=2)
        (d / "index.html").write_text("<section class='slide'>x</section><section class='slide'>y</section>")
        found = decks.scan_decks([str(self.root)])[0]
        self.assertEqual((found["kind"], found["entry"], found["slideCount"]), ("slides", None, 2))


if __name__ == "__main__":
    unittest.main()
