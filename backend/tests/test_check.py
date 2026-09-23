"""Tests for check.py and inject/check.js (real headless run when a browser is available)."""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import check  # noqa: E402
import export  # noqa: E402
import preview  # noqa: E402

BROWSER = export.find_browser()

SLIDE_A = (
    '<section class="slide"><p class="eyebrow">SECTION 01 \u00b7 ACME</p><h1>Hello \u2014 world</h1>'
    '<p style="font-size:9px;color:#bbb">faint text</p>'
    '<div style="position:absolute;left:1200px;top:600px;width:200px;height:200px"><p>outside</p></div>'
    '<div style="position:absolute;left:100px;top:300px;width:300px;height:40px;overflow:hidden"><p>' + "long text " * 80 + "</p></div>"
    '<p style="position:absolute;left:100px;top:100px">A text</p><p style="position:absolute;left:110px;top:104px">B text overlapping</p>'
    '<img src="img/missing.png" alt="x" width="100" height="100">'
    '<img src="https://example.invalid/x.png" alt="ext" width="10" height="10"></section>'
)
SLIDE_B = '<section class="slide"><h2>Clean</h2><p>Nothing wrong here. <b>Bold</b> runs <b>wrap</b> fine.</p></section>'


class StaticTests(unittest.TestCase):
    def test_missing_cover_and_first_slide_classes(self) -> None:
        self.assertEqual(check.first_slide_classes('<section class="slide cover active"><h1>x</h1></section>'), ["slide", "cover"])
        self.assertEqual(check.static_issues(["010.html"], ["slide"])[0]["rule"], "missing-cover")
        self.assertEqual(check.static_issues(["010.html"], ["slide", "cover"]), [])
        self.assertEqual(check.static_issues([], []), [])

    def test_disabled_rules_and_finish(self) -> None:
        self.assertEqual(check.disabled_rules({"check": {"disable": ["contrast", "eyebrow"]}}), {"contrast", "eyebrow"})
        self.assertEqual(check.disabled_rules(None), set())
        issues = [
            {"rule": "contrast", "slideIndex": 1, "detail": "x"},
            {"rule": "overflow", "slideIndex": 1, "detail": "y"},
            {"rule": "punctuation", "slideIndex": 0, "detail": "z"},
            {"rule": "bogus", "slideIndex": 0, "detail": "?"},
        ]
        r = check.finish(issues, ["a.html", "b.html"], {"contrast"})
        self.assertEqual([(i["slideIndex"], i["rule"], i["severity"], i["slideFile"]) for i in r["issues"]],
                         [(0, "punctuation", "warning", "a.html"), (1, "overflow", "error", "b.html")])
        self.assertEqual(r["counts"], {"punctuation": 1, "overflow": 1})
        self.assertNotIn("contrast", r["rules"])
        self.assertEqual(r["disabled"], ["contrast"])


@unittest.skipIf(BROWSER is None, "no headless Chromium available")
class RenderedTests(unittest.TestCase):
    def test_every_rendered_rule_fires_once_and_clean_slide_is_clean(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp) / "deck"
            (deck / "slides").mkdir(parents=True)
            (deck / "slides" / "010.html").write_text(SLIDE_A, encoding="utf-8")
            (deck / "slides" / "020.html").write_text(SLIDE_B, encoding="utf-8")
            p = preview.DeckPreview(deck, "slides", None)
            port = p.start()
            try:
                r = check.run_rendered(BROWSER, f"http://127.0.0.1:{port}/check", timeout=90)
            finally:
                p.stop()
        self.assertEqual(r["count"], 2)
        by_rule: dict[str, list[dict]] = {}
        for i in r["issues"]:
            by_rule.setdefault(i["rule"], []).append(i)
        self.assertEqual(sorted(by_rule), ["broken-image", "clipped", "contrast", "external-resource", "inline-font-size", "overflow", "overlap", "punctuation"])
        # everything is on slide 0; the clean slide (b/wrap inline runs) reports nothing
        self.assertTrue(all(i["slideIndex"] == 0 for i in r["issues"]))
        # the label line itself is fine; its middle dot and the heading's em dash are not
        self.assertEqual(sorted((i["tag"], i["detail"]) for i in by_rule["punctuation"]), [("h1", "contains em dash"), ("p", "contains middle dot")])
        self.assertEqual({i["src"] for i in by_rule["broken-image"]}, {"img/missing.png", "https://example.invalid/x.png"})
        self.assertIn("https://example.invalid/x.png", by_rule["external-resource"][0]["detail"])
        self.assertEqual(by_rule["clipped"][0]["tag"], "div")
        # overflow reports the outermost offender only (the absolutely positioned div, not its <p>)
        outer = [i for i in by_rule["overflow"] if i["selector"] == "div:nth-of-type(1)"]
        self.assertEqual(len(outer), 1)
        self.assertIn("horizontally", outer[0]["detail"])
        self.assertTrue(any(i["text"] == "A text" for i in by_rule["overlap"]))
        self.assertIn("needs 4.5:1", by_rule["contrast"][0]["detail"])
        for i in r["issues"]:
            self.assertTrue(i["selector"], i)
            self.assertIsNotNone(i["rect"], i)


if __name__ == "__main__":
    unittest.main()
