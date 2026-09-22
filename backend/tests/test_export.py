"""Unit tests for backend/export.py.

Run:  python3 -m unittest backend/tests/test_export.py
The real-render tests are skipped when no headless Chromium is available.
"""
from __future__ import annotations

import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import export  # noqa: E402
import preview  # noqa: E402

BROWSER = export.find_browser()


def pdf_pages(data: bytes) -> int:
    return data.count(b"/Type /Page") - data.count(b"/Type /Pages")


class NameTests(unittest.TestCase):
    def test_safe_pdf_name(self) -> None:
        self.assertEqual(export.safe_pdf_name("Acme Q3 review"), "Acme Q3 review.pdf")
        self.assertEqual(export.safe_pdf_name("a/b:c*d"), "a_b_c_d.pdf")
        self.assertEqual(export.safe_pdf_name("   "), "deck.pdf")
        self.assertEqual(export.safe_pdf_name("분기 리뷰"), "분기 리뷰.pdf")


class JobTests(unittest.TestCase):
    def test_unknown_job(self) -> None:
        self.assertIsNone(export.ExportJobs().status("nope"))

    def test_job_error_when_browser_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            jobs = export.ExportJobs()
            jid = jobs.start("/definitely/not/a/browser", "http://127.0.0.1:1/x.html", Path(tmp) / "o.pdf")
            for _ in range(50):
                st = jobs.status(jid)
                if st and st["state"] != "running":
                    break
                time.sleep(0.05)
            self.assertEqual(st["state"], "error")
            self.assertEqual(st["error"], "pdf_failed")


@unittest.skipIf(BROWSER is None, "no headless Chromium available")
class RenderTests(unittest.TestCase):
    def test_renders_deck_output_with_print_rules(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            deck = Path(tmp) / "deck"
            (deck / "out").mkdir(parents=True)
            (deck / "out" / "index.html").write_text(
                "<html><head><style>@page{size:1280px 720px;margin:0}html,body{margin:0;padding:0}"
                ".slide{box-sizing:border-box;width:1280px;height:720px;overflow:hidden;break-after:page;background:#123;color:#fff}"
                ".slide:last-of-type{break-after:auto}"
                "@media print{.hidden-in-print{display:none}}</style></head><body>"
                "<section class='slide'>one</section><section class='slide'>two</section>"
                "<section class='slide hidden-in-print'>three</section></body></html>"
            )
            p = preview.DeckPreview(deck, "slides", None, extra_files=("out/index.html",))
            port = p.start()
            try:
                out = deck / "deck.pdf"
                export.render_pdf(BROWSER, f"http://127.0.0.1:{port}/out/index.html", out, timeout=60)
                data = out.read_bytes()
                self.assertTrue(data.startswith(b"%PDF"))
                self.assertEqual(pdf_pages(data), 2)  # hidden-in-print slide excluded
                self.assertFalse(out.with_suffix(".pdf.part").exists())
            finally:
                p.stop()


if __name__ == "__main__":
    unittest.main()
