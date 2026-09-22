"""Unit tests for backend/preview.py.

Run:  python3 -m unittest backend/tests/test_preview.py
"""
from __future__ import annotations

import sys
import tempfile
import unittest
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import preview  # noqa: E402


def get(url: str) -> tuple[int, bytes, str]:
    try:
        with urllib.request.urlopen(url, timeout=2) as r:
            return r.status, r.read(), r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        with e:
            return e.code, e.read(), ""


class WrapTests(unittest.TestCase):
    def test_wrap_with_css_href(self) -> None:
        page = preview.wrap_slide("<section class='slide'>hi</section>", css_href="/assets/deck.css", title="a")
        self.assertIn('<link rel="stylesheet" href="/assets/deck.css">', page)
        self.assertIn(".hs-stage>.slide{display:flex!important", page)
        self.assertNotIn("--hs-accent", page)  # no default theme when the deck has CSS

    def test_wrap_without_css_uses_default_theme(self) -> None:
        page = preview.wrap_slide("<section class='slide'>hi</section>", css_href=None)
        self.assertIn("--hs-accent", page)
        self.assertNotIn("<link", page)

    def test_title_escaped(self) -> None:
        page = preview.wrap_slide("", css_href=None, title="<b>x</b>")
        self.assertIn("&lt;b&gt;x&lt;/b&gt;", page)

    def test_base_href_for_relative_assets(self) -> None:
        page = preview.wrap_slide("<section class='slide'><img src='img/a.png'></section>", css_href=None)
        self.assertIn('<base href="/">', page)

    def test_page_number_injected_into_footer_once(self) -> None:
        frag = '<section class="slide"><div class="slide-foot"><span class="wm"></span></div></section>'
        page = preview.wrap_slide(frag, css_href=None, page_number=7)
        self.assertIn('<span class="wm"></span><span class="pageno">7</span></div>', page)
        again = preview.wrap_slide(page, css_href=None, page_number=8)
        self.assertEqual(again.count('class="pageno"'), 1)
        no_foot = preview.wrap_slide('<section class="slide">x</section>', css_href=None, page_number=3)
        self.assertNotIn("pageno", no_foot)


class ServerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        deck = Path(self.tmp.name) / "deck"
        (deck / "slides").mkdir(parents=True)
        (deck / "assets").mkdir()
        (deck / "slides" / "010_a.html").write_text("<section class='slide cover'><h1>A</h1></section>")
        (deck / "slides" / "020_b.html").write_text("<section class='slide'><h2>B</h2></section>")
        (deck / "assets" / "deck.css").write_text(".slide{color:red}")
        (Path(self.tmp.name) / "secret.txt").write_text("nope")
        self.deck = deck
        self.p = preview.DeckPreview(deck, "slides", "assets/deck.css")
        self.port = self.p.start()
        self.base = f"http://127.0.0.1:{self.port}"

    def tearDown(self) -> None:
        self.p.stop()
        self.tmp.cleanup()

    def test_health(self) -> None:
        code, body, _ = get(f"{self.base}/health")
        self.assertEqual((code, body), (200, b'{"status":"ok"}'))

    def test_slide_pages(self) -> None:
        code, body, ctype = get(f"{self.base}/slide/0")
        self.assertEqual(code, 200)
        self.assertIn("text/html", ctype)
        self.assertIn(b"<h1>A</h1>", body)
        self.assertIn(b'href="/assets/deck.css"', body)
        code, body, _ = get(f"{self.base}/slide/1")
        self.assertIn(b"<h2>B</h2>", body)

    def test_slide_out_of_range_and_bad_index(self) -> None:
        self.assertEqual(get(f"{self.base}/slide/2")[0], 404)
        self.assertEqual(get(f"{self.base}/slide/x")[0], 400)

    def test_static_asset_served(self) -> None:
        code, body, ctype = get(f"{self.base}/assets/deck.css")
        self.assertEqual(code, 200)
        self.assertEqual(body, b".slide{color:red}")
        self.assertIn("text/css", ctype)

    def test_static_containment(self) -> None:
        self.assertEqual(get(f"{self.base}/assets/../../secret.txt")[0], 404)
        self.assertEqual(get(f"{self.base}/assets/%2e%2e/%2e%2e/secret.txt")[0], 404)
        self.assertEqual(get(f"{self.base}/slides/010_a.html")[0], 404)  # not a static prefix
        self.assertEqual(get(f"{self.base}/")[0], 404)

    def test_registry_reuses_and_stops(self) -> None:
        reg = preview.PreviewRegistry()
        a = reg.ensure(self.deck, "slides", None)
        b = reg.ensure(self.deck, "slides", None)
        self.assertIs(a, b)
        self.assertTrue(reg.stop(self.deck))
        self.assertFalse(reg.stop(self.deck))
        reg.stop_all()


if __name__ == "__main__":
    unittest.main()
