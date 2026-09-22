"""Unit tests for backend/build.py.

Run:  python3 -m unittest backend/tests/test_build.py
"""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build  # noqa: E402


def make_deck(folder: Path, slides: list[str], studio: dict | None = None) -> Path:
    (folder / "slides").mkdir(parents=True, exist_ok=True)
    for i, frag in enumerate(slides):
        (folder / "slides" / f"{(i + 1) * 10:03d}.html").write_text(frag)
    if studio is not None:
        (folder / "studio.json").write_text(json.dumps(studio))
    return folder


class ParseTests(unittest.TestCase):
    def test_parse_issues(self) -> None:
        out = ("slide validation failed:\n  030_cost.html: contains em dash (use · or : instead)\n"
               "  030_cost.html: contains em dash (use · or : instead)\n  010.html: expected exactly 1 <section>, found 2\n"
               "random noise\n")
        self.assertEqual(build.parse_issues(out), [
            {"file": "030_cost.html", "message": "contains em dash (use · or : instead)"},
            {"file": "010.html", "message": "expected exactly 1 <section>, found 2"},
        ])


class ContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.data = self.root / "data"

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_defaults_without_studio(self) -> None:
        deck = make_deck(self.root / "d", ["<section class='slide'>a</section>"])
        c = build.build_contract(deck)
        self.assertTrue(c["builtin"])
        self.assertIsNone(c["command"])
        self.assertEqual(c["output"], "out/index.html")
        self.assertFalse(c["outputExists"])

    def test_output_escape_falls_back(self) -> None:
        deck = make_deck(self.root / "d", ["x"], {"build": "true", "output": "../evil.html"})
        self.assertEqual(build.build_contract(deck)["output"], "out/index.html")

    def test_trust_roundtrip(self) -> None:
        deck = make_deck(self.root / "d", ["x"], {"build": "echo hi"})
        self.assertFalse(build.is_trusted(self.data, deck, "echo hi"))
        build.trust(self.data, deck, "echo hi")
        self.assertTrue(build.is_trusted(self.data, deck, "echo hi"))
        self.assertFalse(build.is_trusted(self.data, deck, "echo hi; rm -rf ~"))  # changed command


class RunTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.data = self.root / "data"

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_builtin_assembles(self) -> None:
        deck = make_deck(self.root / "d", [
            "<section class='slide cover active'><h1>A</h1></section>",
            "<section class='slide'><h2>B</h2></section>",
        ])
        r = build.build(self.data, deck, "slides")
        self.assertTrue(r["ok"], r)
        self.assertEqual(r["mode"], "builtin")
        page = (deck / "out" / "index.html").read_text()
        self.assertIn("<h1>A</h1>", page)
        self.assertIn("<h2>B</h2>", page)
        self.assertNotIn("cover active", page)  # runtime owns .active
        self.assertIn("hs-counter", page)

    def test_builtin_reports_validation_issue(self) -> None:
        deck = make_deck(self.root / "d", ["<section class='slide'>a</section><section>b</section>"])
        r = build.build(self.data, deck, "slides")
        self.assertFalse(r["ok"])
        self.assertEqual(r["issues"][0]["file"], "010.html")
        self.assertFalse((deck / "out" / "index.html").exists())

    def test_external_requires_trust_then_runs(self) -> None:
        cmd = "mkdir -p out && printf '<html>built</html>' > out/index.html && echo done"
        deck = make_deck(self.root / "d", ["x"], {"build": cmd})
        with self.assertRaises(build.BuildError) as ctx:
            build.build(self.data, deck, "slides")
        self.assertEqual(ctx.exception.code, "untrusted_command")
        self.assertEqual(str(ctx.exception), cmd)

        r = build.build(self.data, deck, "slides", trust_command=True)
        self.assertTrue(r["ok"], r)
        self.assertEqual(r["mode"], "external")
        self.assertEqual(r["output"], "out/index.html")
        self.assertIn("done", r["stdout"])
        # second run needs no consent
        r2 = build.build(self.data, deck, "slides")
        self.assertTrue(r2["ok"])

    def test_external_failure_parses_issues(self) -> None:
        cmd = "echo '020.html: contains em dash' >&2; exit 3"
        deck = make_deck(self.root / "d", ["x"], {"build": cmd})
        r = build.build(self.data, deck, "slides", trust_command=True)
        self.assertFalse(r["ok"])
        self.assertEqual(r["exitCode"], 3)
        self.assertEqual(r["issues"], [{"file": "020.html", "message": "contains em dash"}])
        self.assertIsNone(r["output"])

    def test_external_exit_zero_but_no_output_is_failure(self) -> None:
        deck = make_deck(self.root / "d", ["x"], {"build": "true"})
        r = build.build(self.data, deck, "slides", trust_command=True)
        self.assertFalse(r["ok"])


if __name__ == "__main__":
    unittest.main()
