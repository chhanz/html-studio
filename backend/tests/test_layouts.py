"""Tests for layouts.py: built-in listing, user save/read/delete, validation."""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import layouts  # noqa: E402
import preview  # noqa: E402


class LayoutTests(unittest.TestCase):
    def test_builtins_are_single_slide_sections(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            items = layouts.list_layouts(Path(tmp))
            self.assertEqual([i["id"] for i in items], layouts.BUILTIN_ORDER)
            for i in items:
                html = layouts.read_layout(Path(tmp), i["id"])
                self.assertEqual(len(preview.split_sections(html)), 1, i["id"])
                self.assertNotIn("\u2014", html)  # slide punctuation rule
                self.assertNotIn("\u00b7", html)

    def test_user_save_list_read_delete(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            entry = layouts.save_layout(d, "Quarter review", '<section class="slide"><h2>Q</h2></section>')
            self.assertEqual((entry["id"], entry["name"], entry["builtin"]), ("my-quarter-review", "Quarter review", False))
            again = layouts.save_layout(d, "Quarter review", '<section class="slide"><h2>Q2</h2></section>')
            self.assertEqual(again["id"], "my-quarter-review-2")
            ids = [i["id"] for i in layouts.list_layouts(d)]
            self.assertEqual(ids[: len(layouts.BUILTIN_ORDER)], layouts.BUILTIN_ORDER)
            self.assertEqual(ids[len(layouts.BUILTIN_ORDER):], ["my-quarter-review-2", "my-quarter-review"])
            self.assertEqual(layouts.read_layout(d, "my-quarter-review").strip(), '<section class="slide"><h2>Q</h2></section>')
            layouts.delete_layout(d, "my-quarter-review")
            self.assertFalse((d / "layouts" / "my-quarter-review.json").exists())
            for bad in ("cover", "../x", "my-nope"):
                with self.assertRaises(layouts.LayoutError):
                    layouts.delete_layout(d, bad)
            with self.assertRaises(layouts.LayoutError):
                layouts.read_layout(d, "../../etc/passwd")
            with self.assertRaises(layouts.LayoutError):
                layouts.save_layout(d, "", "<section class='slide'>x</section>")


if __name__ == "__main__":
    unittest.main()
