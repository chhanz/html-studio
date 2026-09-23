"""Tests for notes.py: sidecar naming, read/write, orphan detection."""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import notes  # noqa: E402


class NotesTests(unittest.TestCase):
    def test_names(self) -> None:
        self.assertEqual(notes.note_name("030_uptime.html"), "030_uptime.md")
        self.assertEqual(notes.note_name("010 Cover.HTM"), "010_Cover.md")
        self.assertEqual(notes.note_name("index.html#3"), "index-3.md")

    def test_write_read_remove_and_orphans(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp)
            self.assertEqual(notes.read_note(deck, "010.html"), "")
            p = notes.write_note(deck, "010.html", "- point one\n- point two")
            self.assertEqual(p, deck / "notes" / "010.md")
            self.assertEqual(p.read_text(), "- point one\n- point two\n")  # newline added
            self.assertEqual(notes.read_note(deck, "010.html"), "- point one\n- point two\n")
            (deck / "notes" / "999_gone.md").write_text("old")
            self.assertEqual(notes.list_notes(deck, ["010.html", "020.html"]), {"withNotes": ["010.html"], "orphans": ["999_gone.md"], "dir": "notes"})
            notes.write_note(deck, "010.html", "   \n")
            self.assertFalse(p.exists())  # empty text removes the sidecar
            self.assertEqual(notes.list_notes(deck, ["010.html"])["withNotes"], [])
            self.assertEqual(notes.list_notes(Path(tmp) / "nodir", ["a.html"]), {"withNotes": [], "orphans": [], "dir": "notes"})


if __name__ == "__main__":
    unittest.main()
