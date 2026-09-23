"""Tests for newdeck.py: folder validation, generated files, themes, cleanup on failure."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import decks  # noqa: E402
import newdeck  # noqa: E402


class NewDeckTests(unittest.TestCase):
    def test_slug_and_folder_rules(self) -> None:
        self.assertEqual(newdeck.slugify("Q3 Review: Acme & Co"), "q3-review-acme-co")
        self.assertEqual(newdeck.slugify("분기 리뷰 2026"), "분기-리뷰-2026")
        self.assertEqual(newdeck.slugify("!!!"), "deck")
        for bad in ("", ".hidden", "..", "a/b", "name.", "x" * 90):
            with self.assertRaises(newdeck.NewDeckError):
                newdeck.validate_folder(bad)

    def test_default_theme_deck(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            deck = newdeck.create_deck(root, "acme-q3", {"title": "Acme Q3 <Review>", "presenter": "Jamie", "purpose": "Show the quarter.\nSecond line.", "audience": "Acme leadership", "sources": "- notes.md\n- https://example.invalid/report"}, {"kind": "default"})
            self.assertEqual(deck, root / "acme-q3")
            info = decks.describe_deck(deck, root)
            self.assertEqual((info["kind"], info["slides"], info["hasStudioJson"], info["hasDesignMd"]), ("slides", ["010_cover.html", "020_agenda.html"], True, False))
            cover = (deck / "slides" / "010_cover.html").read_text()
            self.assertIn("<h1>Acme Q3 &lt;Review&gt;</h1>", cover)
            self.assertIn("<p>Show the quarter.</p>", cover)
            self.assertIn('<p class="muted">Acme leadership</p>', cover)
            self.assertIn("Jamie. 20", cover)
            self.assertIn("<h2>Agenda</h2>", (deck / "slides" / "020_agenda.html").read_text())
            brief = (deck / "brief.md").read_text()
            self.assertIn("## Source material\n\n- notes.md", brief)
            studio = json.loads((deck / "studio.json").read_text())
            self.assertEqual((studio["slidesDir"], studio["title"], studio["presenter"]), ("slides", "Acme Q3 <Review>", "Jamie"))
            self.assertNotIn("css", studio)
            with self.assertRaises(newdeck.NewDeckError) as ctx:
                newdeck.create_deck(root, "acme-q3", {"title": "again"}, {"kind": "default"})
            self.assertEqual(ctx.exception.code, "exists")

    def test_design_theme_and_copy_theme(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            deck = newdeck.create_deck(root, "themed", {"title": "Themed"}, {"kind": "design", "accent": "#0F766E", "bg": "#ffffff", "fg": "#111827", "font": "Pretendard"})
            tokens = (deck / "tokens.css").read_text()
            self.assertIn("--hs-accent: var(--color-primary)", tokens)
            self.assertIn("--color-primary: #0f766e", tokens)
            self.assertIn("--hs-cover: var(--color-secondary)", tokens)
            self.assertIn("--font-sans: Pretendard", tokens)
            self.assertEqual(json.loads((deck / "studio.json").read_text())["css"], "tokens.css")
            self.assertTrue(decks.describe_deck(deck, root)["hasDesignMd"])
            # Copy the theme into a second deck.
            other = newdeck.create_deck(root, "copied", {"title": "Copied"}, {"kind": "copy"}, copy_from=deck)
            self.assertEqual((other / "tokens.css").read_text(), tokens)
            self.assertTrue((other / "DESIGN.md").is_file())
            self.assertEqual(json.loads((other / "studio.json").read_text())["css"], "tokens.css")
            # Bad colour: nothing is left behind.
            with self.assertRaises(newdeck.NewDeckError):
                newdeck.create_deck(root, "broken", {"title": "x"}, {"kind": "design", "accent": "red", "bg": "#fff", "fg": "#000"})
            self.assertFalse((root / "broken").exists())
            with self.assertRaises(newdeck.NewDeckError):
                newdeck.create_deck(root, "nocopy", {"title": "x"}, {"kind": "copy"}, copy_from=root / "acme-none")


if __name__ == "__main__":
    unittest.main()
