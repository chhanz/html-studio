"""Tests for design.py: DESIGN.md parsing and tokens.css generation."""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import design  # noqa: E402

# Same shape as real Stitch / getdesign.md exports: prose with inline token
# references and values, a typography table, a rounded table, spacing inline.
ACME = """## Overview

Acme looks like a lab notebook. The canvas is a warm off-white `{colors.canvas-soft}` (#f7f4ee),
type is set in `AcmeSans` in near-black `{colors.ink}` and says one thing in colour:
a single teal, `{colors.primary}` (#0f766e), for actions and links. Cards round at 12px (`{rounded.lg}`),
CTAs are pills (`{rounded.full}`), utility buttons round at a tighter 8px (`{rounded.md}`).

## Colors

### Brand
- **Acme Teal** (`{colors.primary}` — #0f766e): the single structural accent.
- **Pressed Teal** (`{colors.primary-active}` — #115e59).
- **Night** (`{colors.secondary}` — #1e293b): inverted hero band.
- **Sticker Coral** (`{colors.accent-coral}` — #fb7185) / **Deep Coral** (`{colors.accent-coral-deep}` — #9f1239)

### Surface
- **White** (`{colors.canvas}` / `{colors.surface}` — #ffffff): cards and fields.
- **Hairline** (`{colors.hairline}` — #e7e5e4): 1px borders.

### Text
- **Ink** (`{colors.ink}` — #111111): headings and body.
- **Stone** (`{colors.ink-muted}` — #6b7280): supporting copy.

## Typography

### Font Family
The system is set in **`AcmeSans`** with a fallback stack of `Inter, system-ui, "Segoe UI", Arial`.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-1}` | 64px | 700 | 1.0 | −2px | Hero |
| `{typography.body-md}` | 16px | 400 | 1.5 | 0 | Body |
| `{typography.eyebrow}` | 12px | 600 | 1.33 | +0.125px | Labels |

## Layout

### Spacing System
- **Tokens**: `{spacing.xs}` 8px · `{spacing.md}` 16px · `{spacing.lg}` 24px.

## Shapes

| Token | Value | Use |
|---|---|---|
| `{rounded.md}` | 8px | Utility buttons |
| `{rounded.lg}` | 12px | Cards |
| `{rounded.full}` | 9999px | Pills |
"""

FRONT = """---
name: Acme Lab
colors:
  primary: "#123456"
  canvas: "#fafafa"
typography:
  display-1:
    fontFamily: "Acme Display, serif"
    fontSize: 72px
    fontWeight: 800
rounded:
  lg: 14px
---
# Acme Lab

Body mentions `{colors.primary}` (#0f766e) which the front matter overrides.
"""


class ParseTests(unittest.TestCase):
    def test_prose_and_tables(self) -> None:
        d = design.parse_design_md(ACME)
        self.assertEqual(d.colors["primary"], "#0f766e")
        self.assertEqual(d.colors["primary-active"], "#115e59")
        self.assertEqual(d.colors["accent-coral"], "#fb7185")
        self.assertEqual(d.colors["accent-coral-deep"], "#9f1239")
        # chained tokens share the value that follows the chain
        self.assertEqual(d.colors["canvas"], "#ffffff")
        self.assertEqual(d.colors["surface"], "#ffffff")
        # a token mentioned without a value nearby does not steal a later one
        self.assertEqual(d.colors["ink"], "#111111")
        self.assertEqual(d.colors["canvas-soft"], "#f7f4ee")
        # tables override the prose ("8px" sat before {rounded.md} in the overview too)
        self.assertEqual(d.rounded, {"lg": "12px", "full": "9999px", "md": "8px"})
        self.assertEqual(d.spacing, {"xs": "8px", "md": "16px", "lg": "24px"})
        t = d.typography["display-1"]
        self.assertEqual((t.size, t.weight, t.line_height, t.letter_spacing), ("64px", "700", "1.0", "-2px"))
        self.assertEqual(d.typography["eyebrow"].letter_spacing, "0.125px")
        self.assertIsNone(d.typography["body-md"].letter_spacing)
        self.assertEqual(d.font_family, "AcmeSans")
        self.assertEqual(d.font_fallback, 'Inter, system-ui, "Segoe UI", Arial')
        self.assertIsNone(d.name)  # no H1 in this file
        self.assertFalse(d.empty)

    def test_front_matter_wins_and_h1_names(self) -> None:
        d = design.parse_design_md(FRONT)
        self.assertEqual(d.name, "Acme Lab")
        self.assertEqual(d.colors["primary"], "#123456")
        self.assertEqual(d.colors["canvas"], "#fafafa")
        self.assertEqual(d.typography["display-1"].size, "72px")
        self.assertEqual(d.typography["display-1"].weight, "800")
        self.assertEqual(d.font_family, "Acme Display")
        self.assertEqual(d.rounded["lg"], "14px")

    def test_empty_document(self) -> None:
        d = design.parse_design_md("# Nothing here\n\nJust words.\n")
        self.assertTrue(d.empty)
        self.assertEqual(d.name, "Nothing here")


class TokensTests(unittest.TestCase):
    def test_tokens_css_and_theme_hooks(self) -> None:
        css = design.tokens_css(design.parse_design_md(ACME))
        self.assertIn("--color-primary: #0f766e;", css)
        self.assertIn("--color-accent-coral-deep: #9f1239;", css)
        self.assertIn('--font-sans: AcmeSans, Inter, system-ui, "Segoe UI", Arial;', css)
        self.assertIn("--space-md: 16px;", css)
        self.assertIn("--radius-full: 9999px;", css)
        self.assertIn("--type-display-1-size: 64px;", css)
        self.assertIn("--type-display-1-tracking: -2px;", css)
        self.assertIn("--hs-accent: var(--color-primary);", css)
        self.assertIn("--hs-bg: var(--color-canvas-soft);", css)
        self.assertIn("--hs-fg: var(--color-ink);", css)
        self.assertIn("--hs-muted: var(--color-ink-muted);", css)
        self.assertIn("--hs-border: var(--color-hairline);", css)
        self.assertIn("--hs-font: var(--font-sans);", css)
        self.assertIn("--hs-cover: var(--color-secondary);", css)
        self.assertIn("--hs-on-cover: var(--color-surface);", css)
        self.assertTrue(css.startswith("/* Generated by HTML Studio"))

    def test_write_and_read(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp)
            self.assertIsNone(design.read_design(deck))
            (deck / "DESIGN.md").write_text(ACME, encoding="utf-8")
            d = design.read_design(deck)
            assert d is not None
            out = design.write_tokens(deck, d)
            self.assertEqual(out, deck / "tokens.css")
            self.assertIn("--color-primary", out.read_text())


if __name__ == "__main__":
    unittest.main()
