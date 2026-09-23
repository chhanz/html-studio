"""Tests for tweak.py: describe, validation, overrides CSS, apply to DESIGN.md + tokens.css."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import newdeck  # noqa: E402
import tweak  # noqa: E402

PROSE_DESIGN = """---
colors:
  primary: "#0f766e"
spacing:
  gutter: "24px"
typography:
  heading:
    fontSize: "40px"
---
# Acme design

| token | value |
| --- | --- |
| primary | #0f766e |

Use {colors.primary} #0f766e for buttons.
"""


class TweakTests(unittest.TestCase):
    def test_describe_and_validate(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            plain = newdeck.create_deck(root, "plain", {"title": "P"}, {"kind": "default"})
            d = tweak.describe(plain)
            self.assertEqual((d["hasDesign"], d["items"][0]["var"], d["items"][-1]["var"]), (False, "--hs-accent", "--hs-font"))
            themed = newdeck.create_deck(root, "themed", {"title": "T"}, {"kind": "design", "accent": "#0f766e", "bg": "#ffffff", "fg": "#111827", "font": "Inter"})
            items = {i["var"]: i for i in tweak.describe(themed)["items"]}
            self.assertEqual(items["--color-primary"]["value"], "#0f766e")
            self.assertEqual(items["--font-sans"]["value"], "Inter")
            self.assertEqual(tweak.validate_changes({"--color-primary": " #FF0000 "}), {"--color-primary": "#FF0000"})
            for bad in ({"color-primary": "#fff"}, {"--x": "a;b"}, {"--x": "<script>"}, ["--x"], {"--x": 3}):
                with self.assertRaises(tweak.TweakError):
                    tweak.validate_changes(bad)
            self.assertEqual(tweak.overrides_css({"--a": "1px", "--b": "#fff"}), ":root{--a:1px!important;--b:#fff!important;}")
            self.assertEqual(tweak.overrides_css({}), "")

    def test_apply_updates_front_matter_prose_and_tokens(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp)
            (deck / "slides").mkdir()
            (deck / "DESIGN.md").write_text(PROSE_DESIGN)
            r = tweak.apply(deck, {"--color-primary": "#AA0000", "--space-gutter": "32px", "--type-heading-size": "44px", "--color-nope": "#000000"})
            self.assertEqual(r["unknown"], ["--color-nope"])
            text = (deck / "DESIGN.md").read_text()
            self.assertIn('  primary: "#aa0000"', text)
            self.assertIn('  gutter: "32px"', text)
            self.assertIn('    fontSize: "44px"', text)
            self.assertIn("| primary | #aa0000 |", text)  # prose table kept in step
            self.assertIn("{colors.primary} #aa0000", text)
            self.assertTrue(text.split("---")[2].lstrip().startswith("# Acme design"))
            tokens = (deck / "tokens.css").read_text()
            self.assertIn("--color-primary: #aa0000;", tokens)
            self.assertIn("--space-gutter: 32px;", tokens)
            self.assertIn("--type-heading-size: 44px;", tokens)
            self.assertEqual(json.loads((deck / "studio.json").read_text())["css"], "tokens.css")
            with self.assertRaises(tweak.TweakError):
                tweak.apply(deck, {"--color-primary": "red"})

    def test_own_css_deck_keeps_its_stylesheet_and_layers_tokens(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp)
            (deck / "slides").mkdir()
            (deck / "slides" / "010.html").write_text("<section class='slide'>x</section>")
            (deck / "assets").mkdir()
            (deck / "assets" / "deck.css").write_text(".slide{color:red}")
            r = tweak.apply(deck, {"--hs-accent": "#00aa00"})
            self.assertTrue(r["created"])
            self.assertTrue((deck / "tokens.css").is_file())
            self.assertFalse((deck / "studio.json").exists())  # css choice untouched: assets/deck.css still wins
            d = tweak.describe(deck)
            self.assertEqual((d["css"], d["layered"]), ("assets/deck.css", True))

    def test_apply_creates_design_for_plain_deck(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = newdeck.create_deck(Path(tmp), "plain", {"title": "P"}, {"kind": "default"})
            r = tweak.apply(deck, {"--hs-accent": "#00aa00", "--hs-font": "Inter"})
            self.assertTrue(r["created"])
            tokens = (deck / "tokens.css").read_text()
            self.assertIn("--color-primary: #00aa00;", tokens)
            self.assertIn("--hs-accent: var(--color-primary);", tokens)
            self.assertIn("--font-sans: Inter;", tokens)
            self.assertEqual(json.loads((deck / "studio.json").read_text())["css"], "tokens.css")
            # Second apply on the now-themed deck uses token variables.
            r2 = tweak.apply(deck, {"--color-primary": "#0000aa"})
            self.assertFalse(r2["created"])
            self.assertIn("--color-primary: #0000aa;", (deck / "tokens.css").read_text())


if __name__ == "__main__":
    unittest.main()
