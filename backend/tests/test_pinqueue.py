"""Tests for pinqueue.py and report.py: batches, replies, prompt."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
import pinqueue  # noqa: E402

PINS = [
    {
        "id": "p1", "index": 1, "slideIndex": 0, "slideFile": "slides/010_cover.html", "cid": None,
        "selector": "h1:nth-of-type(1)", "tag": "h1", "elementId": None, "classes": ["title"],
        "text": "Acme Quarterly Review", "rect": {"x": 64, "y": 56, "w": 900, "h": 70}, "src": None,
        "comment": "Shorter title",
    },
    {
        "id": "p2", "index": 3, "slideIndex": 2, "slideFile": "slides/030_uptime.html", "cid": "old-cid",
        "selector": "img:nth-of-type(1)", "tag": "img", "elementId": None, "classes": ["fixture-img"],
        "text": "", "rect": {"x": 64, "y": 200, "w": 320, "h": 180}, "src": "img/chart.png",
        "comment": "",
    },
]


class BatchTests(unittest.TestCase):
    def test_make_write_load_and_replies(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp) / "deck"
            deck.mkdir()
            q = Path(tmp) / "queue"
            batch = pinqueue.make_batch(deck, "deck", PINS, "ko")
            self.assertEqual(batch["type"], "visual_edit_batch")
            self.assertEqual([c["cid"] for c in batch["comments"]], [f"{batch['id']}-1", f"{batch['id']}-2"])
            c2 = batch["comments"][1]
            self.assertEqual((c2["index"], c2["existingCid"], c2["pinId"]), (3, "old-cid", "p2"))
            self.assertEqual(c2["slidePath"], str((deck / "slides/030_uptime.html").resolve()))

            path = pinqueue.write_batch(q, batch)
            self.assertTrue(path.is_file())
            loaded = pinqueue.load_batch(path)
            assert loaded is not None
            self.assertEqual(loaded["state"], "sent")
            self.assertTrue(all(c["status"] == "sent" for c in loaded["comments"]))

            # report.py (the agent's CLI) appends replies; the batch file is untouched.
            before = path.read_bytes()
            cid1 = batch["comments"][0]["cid"]
            r = subprocess.run(
                [sys.executable, str(BACKEND / "report.py"), "--batch", str(path), "--cid", cid1, "--status", "done", "--text", "Title shortened"],
                capture_output=True, text=True,
            )
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertEqual(json.loads(r.stdout)["status"], "done")
            self.assertEqual(path.read_bytes(), before)
            bad = subprocess.run([sys.executable, str(BACKEND / "report.py"), "--batch", str(path), "--cid", "nope", "--status", "done", "--text", "x"], capture_output=True, text=True)
            self.assertEqual(bad.returncode, 2)
            self.assertIn("unknown cid", bad.stderr)

            loaded = pinqueue.load_batch(path)
            assert loaded is not None
            self.assertEqual(loaded["comments"][0]["status"], "done")
            self.assertEqual(loaded["comments"][0]["thread"], [{"role": "agent", "text": "Title shortened", "ts": loaded["comments"][0]["thread"][0]["ts"]}])
            self.assertEqual(loaded["state"], "sent")  # second comment still open
            pinqueue.append_reply(path, batch["comments"][1]["cid"], "question", "Which chart?")
            loaded = pinqueue.load_batch(path)
            assert loaded is not None
            self.assertEqual(loaded["comments"][1]["status"], "question")
            self.assertEqual(loaded["state"], "done")  # every comment answered one way or the other
            # The user's answer reopens the comment (status back to sent) and joins the thread.
            pinqueue.append_reply(path, batch["comments"][1]["cid"], "sent", "Full width", role="user")
            loaded = pinqueue.load_batch(path)
            assert loaded is not None
            self.assertEqual(loaded["comments"][1]["status"], "sent")
            self.assertEqual([m["role"] for m in loaded["comments"][1]["thread"]], ["agent", "user"])
            self.assertEqual(loaded["state"], "sent")
            with self.assertRaises(ValueError):
                pinqueue.append_reply(path, batch["comments"][1]["cid"], "done", "x", role="user")

            self.assertEqual([b["id"] for b in pinqueue.list_batches(q, deck)], [batch["id"]])
            self.assertEqual(pinqueue.list_batches(q, Path(tmp) / "other"), [])

    def test_prompt_lists_every_comment_and_the_tools(self) -> None:
        deck = Path("/tmp/x/deck")
        batch = pinqueue.make_batch(deck, "deck", PINS, "ko")
        prompt = pinqueue.build_prompt(batch, Path("/q/b.json"), Path("/app/skills/deck-visual-edit/SKILL.md"), Path("/app/backend/report.py"))
        self.assertIn("/app/skills/deck-visual-edit/SKILL.md", prompt)
        self.assertIn('python3 "/app/backend/report.py" --batch "/q/b.json" --cid <cid> --status done', prompt)
        self.assertIn(f"[{batch['id']}-1] slides/010_cover.html > h1:nth-of-type(1) \"Acme Quarterly Review\": Shorter title", prompt)
        self.assertIn(f"[{batch['id']}-2] slides/030_uptime.html > img:nth-of-type(1): (no comment", prompt)
        self.assertIn("Answer in Korean", prompt)
        self.assertNotIn("\u2014", prompt)

    def test_bad_ids_are_refused(self) -> None:
        with self.assertRaises(ValueError):
            pinqueue.batch_path(Path("/q"), "../etc")


if __name__ == "__main__":
    unittest.main()
