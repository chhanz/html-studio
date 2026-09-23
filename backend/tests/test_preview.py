"""Unit tests for backend/preview.py.

Run:  python3 -m unittest backend/tests/test_preview.py
"""
from __future__ import annotations

import json
import sys
import tempfile
import time
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
        c = reg.ensure(self.deck, "slides", None, extra_files=("index.html",))
        self.assertIsNot(a, c)  # allow-list changed -> restarted
        self.assertTrue(reg.stop(self.deck))
        self.assertFalse(reg.stop(self.deck))
        reg.stop_all()

    def test_extra_file_allowlist(self) -> None:
        (self.deck / "index.html").write_text("<html>built</html>")
        (self.deck / "studio.json").write_text("{}")
        p = preview.DeckPreview(self.deck, "slides", None, extra_files=("index.html",))
        port = p.start()
        try:
            base = f"http://127.0.0.1:{port}"
            self.assertEqual(get(f"{base}/index.html")[0], 200)
            self.assertEqual(get(f"{base}/studio.json")[0], 404)  # not allow-listed
        finally:
            p.stop()


class SingleFileTests(unittest.TestCase):
    DOC = (
        "<!doctype html><html><head><title>T</title><meta charset='utf-8'>"
        "<link rel=\"stylesheet\" href=\"assets/deck.css\"><style>.x{color:red}</style></head><body>"
        "<svg xmlns='http://www.w3.org/2000/svg' style='display:none'><symbol id='i-a'></symbol></svg>"
        "<div class='progress-bar'></div>"
        "<section class=\"slide cover active\"><h1>One</h1></section>"
        "<section class='slide'><h2>Two</h2><use href='#i-a'/><div class='slide-foot'></div></section>"
        "<section class='not-a-slide'>ignored</section>"
        "</body></html>"
    )

    def test_split_sections(self) -> None:
        secs = preview.split_sections(self.DOC)
        self.assertEqual(len(secs), 2)
        self.assertIn("<h1>One</h1>", secs[0])
        self.assertIn("<h2>Two</h2>", secs[1])

    def test_inherited_chrome(self) -> None:
        head, hidden = preview.inherited_chrome(self.DOC)
        self.assertIn('href="assets/deck.css"', head)
        self.assertIn(".x{color:red}", head)
        self.assertNotIn("<title>", head)
        self.assertIn("<symbol id='i-a'>", hidden)

    def test_render_single_file_slide(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp)
            (deck / "index.html").write_text(self.DOC)
            p = preview.DeckPreview(deck, "slides", None, entry="index.html")
            self.assertEqual(p.slide_count(), 2)
            page = p.render_slide(1)
            assert page is not None
            self.assertIn("<h2>Two</h2>", page)
            self.assertIn("<symbol id='i-a'>", page)          # icon library carried over
            self.assertIn('href="assets/deck.css"', page)     # deck's own stylesheet
            self.assertNotIn("--hs-accent", page)             # no default theme injected
            self.assertIn('class="pageno">2<', page)
            self.assertIsNone(p.render_slide(2))


class PrintDocumentTests(unittest.TestCase):
    def test_print_document_has_every_slide_and_page_rules(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp) / "deck"
            (deck / "slides").mkdir(parents=True)
            (deck / "deck.css").write_text(".slide{background:red}")
            for i in range(3):
                (deck / "slides" / f"{(i + 1) * 10:03d}.html").write_text(
                    f"<section class='slide'><h1>S{i}</h1><footer class='botbar'><span class='pg'></span></footer></section>"
                )
            p = preview.DeckPreview(deck, "slides", "deck.css")
            doc = p.render_print()
            self.assertEqual(doc.count("<section"), 3)
            self.assertIn("@page{size:1280px 720px;margin:0}", doc)
            self.assertIn('href="/deck.css"', doc)
            self.assertIn('<base href="/">', doc)
            self.assertNotIn("hs-counter", doc)
            port = p.start()
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/print") as r:
                    self.assertEqual(r.status, 200)
                    self.assertIn(b"hs-print", r.read())
            finally:
                p.stop()


class RootStylesheetTests(unittest.TestCase):
    def test_root_level_stylesheet_is_served_and_overlays_default_theme(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp) / "deck"
            (deck / "slides").mkdir(parents=True)
            (deck / "slides" / "010.html").write_text("<section class='slide'>x</section>")
            (deck / "tokens.css").write_text(":root{--hs-accent:#0f766e}")
            p = preview.DeckPreview(deck, "slides", "tokens.css")
            port = p.start()
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/tokens.css") as r:
                    self.assertEqual(r.status, 200)
                page = urllib.request.urlopen(f"http://127.0.0.1:{port}/slide/0").read().decode()
                self.assertIn("--hs-accent:#6d5efc", page)  # default theme kept (tokens are an overlay)
                self.assertLess(page.index("--hs-accent:#6d5efc"), page.index('href="/tokens.css"'))
                with self.assertRaises(urllib.error.HTTPError) as ctx:
                    urllib.request.urlopen(f"http://127.0.0.1:{port}/DESIGN.md")
                ctx.exception.close()
            finally:
                p.stop()
            reg = preview.PreviewRegistry()
            a = reg.ensure(deck, "slides", "tokens.css")
            self.assertIs(reg.ensure(deck, "slides", "tokens.css"), a)  # same css: reused
            b = reg.ensure(deck, "slides", None)
            self.assertIsNot(b, a)  # css changed: restarted
            reg.stop_all()


class PresentHelperTests(unittest.TestCase):
    def test_helper_injected_only_with_present_query(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp) / "deck"
            (deck / "slides").mkdir(parents=True)
            (deck / "slides" / "010.html").write_text("<section class='slide'>x</section>")
            (deck / "out").mkdir()
            (deck / "out" / "index.html").write_text("<html><body><p>deck</p></body></html>")
            p = preview.DeckPreview(deck, "slides", None, extra_files=("out/index.html",))
            port = p.start()
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/out/index.html") as r:
                    self.assertNotIn(b"hs-hit", r.read())
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/out/index.html?hs=present") as r:
                    body = r.read()
                self.assertIn(b"hs-hit", body)
                self.assertTrue(body.endswith(b"</script></body></html>"), body[-60:])
            finally:
                p.stop()

    def test_select_overlay_injected_only_with_select_query(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp) / "deck"
            (deck / "slides").mkdir(parents=True)
            (deck / "slides" / "010.html").write_text("<section class='slide'><h1>x</h1></section>")
            p = preview.DeckPreview(deck, "slides", None)
            port = p.start()
            try:
                plain = urllib.request.urlopen(f"http://127.0.0.1:{port}/slide/0").read()
                self.assertNotIn(b"hs-capture", plain)
                page = urllib.request.urlopen(f"http://127.0.0.1:{port}/slide/0?hs=select").read()
                self.assertIn(b"hs-capture", page)
                self.assertIn(b"hs-pins", page)
                self.assertTrue(page.endswith(b"</script></body></html>"), page[-40:])
            finally:
                p.stop()

    def test_audience_bridge_injected_with_audience_query(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp) / "deck"
            (deck / "slides").mkdir(parents=True)
            (deck / "slides" / "010.html").write_text("<section class='slide'>x</section>")
            (deck / "out").mkdir()
            (deck / "out" / "index.html").write_text("<html><body><p>deck</p></body></html>")
            p = preview.DeckPreview(deck, "slides", None, extra_files=("out/index.html",))
            port = p.start()
            try:
                body = urllib.request.urlopen(f"http://127.0.0.1:{port}/out/index.html?hs=audience").read()
                self.assertIn(b"/present/state", body)
                self.assertIn(b"hs-laser", body)
                self.assertNotIn(b"hs-hit", body)  # the presenter helper is a different mode
            finally:
                p.stop()

    def test_present_state_relay(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp) / "deck"
            (deck / "slides").mkdir(parents=True)
            (deck / "slides" / "010.html").write_text("<section class='slide'>x</section>")
            p = preview.DeckPreview(deck, "slides", None)
            port = p.start()
            base = f"http://127.0.0.1:{port}/present/state"
            try:
                st = json.loads(urllib.request.urlopen(base).read())
                self.assertEqual((st["seq"], st["index"], st["black"], st["presenter"], st["audience"]), (0, 0, False, False, False))
                def post(obj):
                    req = urllib.request.Request(base, data=json.dumps(obj).encode(), method="POST", headers={"Content-Type": "application/json"})
                    return json.loads(urllib.request.urlopen(req).read())
                st = post({"from": "presenter", "index": 3, "laser": {"on": True, "x": 100, "y": 200}})
                self.assertEqual((st["seq"], st["index"], st["laser"], st["presenter"], st["audience"]), (1, 3, {"on": True, "x": 100, "y": 200}, True, False))
                st = post({"from": "audience"})  # heartbeat only, nothing changes
                self.assertEqual((st["seq"], st["audience"]), (1, True))
                st = post({"from": "audience", "index": 4, "black": True})
                self.assertEqual((st["seq"], st["index"], st["black"]), (2, 4, True))
                st = post({"from": "audience", "index": "nope", "black": "yes"})  # ignored types
                self.assertEqual((st["seq"], st["index"], st["black"]), (2, 4, True))
                with self.assertRaises(urllib.error.HTTPError) as ctx:
                    urllib.request.urlopen(urllib.request.Request(f"http://127.0.0.1:{port}/slide/0", data=b"{}", method="POST"))
                ctx.exception.close()
                # CORS: the dashboard (another loopback port) may call; a foreign origin gets nothing.
                r = urllib.request.urlopen(urllib.request.Request(base, headers={"Origin": "http://127.0.0.1:4321"}))
                self.assertEqual(r.headers.get("Access-Control-Allow-Origin"), "http://127.0.0.1:4321")
                r = urllib.request.urlopen(urllib.request.Request(base, headers={"Origin": "https://evil.example"}))
                self.assertIsNone(r.headers.get("Access-Control-Allow-Origin"))
                r = urllib.request.urlopen(urllib.request.Request(base, method="OPTIONS", headers={"Origin": "http://localhost:9"}))
                self.assertEqual((r.status, r.headers.get("Access-Control-Allow-Methods")), (204, "GET, POST, OPTIONS"))
            finally:
                p.stop()

    def test_present_events_stream_pushes_changes(self) -> None:
        import threading

        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp) / "deck"
            (deck / "slides").mkdir(parents=True)
            (deck / "slides" / "010.html").write_text("<section class='slide'>x</section>")
            p = preview.DeckPreview(deck, "slides", None)
            port = p.start()
            base = f"http://127.0.0.1:{port}"
            try:
                got: list[dict] = []
                resp = urllib.request.urlopen(urllib.request.Request(f"{base}/present/events", headers={"Origin": "http://127.0.0.1:1"}))
                self.assertEqual(resp.headers.get("Content-Type"), "text/event-stream")
                self.assertEqual(resp.headers.get("Access-Control-Allow-Origin"), "http://127.0.0.1:1")

                def reader() -> None:
                    for raw in resp:
                        line = raw.decode().strip()
                        if line.startswith("data: "):
                            got.append(json.loads(line[6:]))
                            if len(got) >= 3:
                                break

                th = threading.Thread(target=reader, daemon=True)
                th.start()
                time.sleep(0.2)
                for body in ({"from": "presenter", "index": 2}, {"from": "presenter", "laser": {"on": True, "x": 5, "y": 6}}):
                    req = urllib.request.Request(f"{base}/present/state", data=json.dumps(body).encode(), method="POST", headers={"Content-Type": "application/json"})
                    urllib.request.urlopen(req).read()
                    time.sleep(0.05)
                th.join(timeout=3)
                resp.close()
                self.assertEqual([g["seq"] for g in got], [0, 1, 2])
                self.assertEqual(got[1]["index"], 2)
                self.assertEqual(got[2]["laser"], {"on": True, "x": 5, "y": 6})
            finally:
                p.stop()

    def test_presenter_page_and_note_endpoint(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp) / "deck"
            (deck / "slides").mkdir(parents=True)
            (deck / "slides" / "010.html").write_text("<section class='slide'>a</section>")
            (deck / "slides" / "020.html").write_text("<section class='slide'>b</section>")
            (deck / "notes").mkdir()
            (deck / "notes" / "020.md").write_text("- say this\n")
            p = preview.DeckPreview(deck, "slides", None)
            port = p.start()
            try:
                page = urllib.request.urlopen(f"http://127.0.0.1:{port}/presenter?lang=ko").read().decode()
                self.assertIn('window.HS_PRESENTER={"count": 2, "slides": ["010.html", "020.html"]', page)
                self.assertIn('"lang": "ko"', page)
                self.assertIn("hs-present-", page)
                n = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{port}/note?slide=020.html").read())
                self.assertEqual(n, {"slide": "020.html", "text": "- say this\n"})
                n = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{port}/note?slide=010.html").read())
                self.assertEqual(n["text"], "")
                with self.assertRaises(urllib.error.HTTPError) as ctx:
                    urllib.request.urlopen(f"http://127.0.0.1:{port}/note?slide=../x")
                ctx.exception.close()
            finally:
                p.stop()

    def test_helper_appended_without_body_tag(self) -> None:
        self.assertTrue(preview.inject_present_helper("<p>x</p>").endswith("</script>"))


if __name__ == "__main__":
    unittest.main()
