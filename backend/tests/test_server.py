"""End-to-end checks for backend/server.py.

Starts the server in a subprocess on a free port with a test proxy secret and
exercises the auth boundary the way the Kiro Crew gateway does.

Run:  python3 -m unittest backend/tests/test_server.py
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SERVER = REPO / "backend" / "server.py"
SECRET = "test-secret"


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def sign(method: str, target: str, body: bytes = b"", ts: int | None = None) -> str:
    ts = int(time.time()) if ts is None else ts
    body_hash = hashlib.sha256(body).hexdigest()
    msg = f"{ts}:{method}:{target}:{body_hash}"
    return f"{ts}:{hmac.new(SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()}"


class ServerTest(unittest.TestCase):
    proc: subprocess.Popen[bytes]
    base: str
    tmp: tempfile.TemporaryDirectory[str]

    @classmethod
    def setUpClass(cls) -> None:
        cls.tmp = tempfile.TemporaryDirectory()
        port = free_port()
        cls.base = f"http://127.0.0.1:{port}"
        env = {
            **os.environ,
            "PORT": str(port),
            "KIROCREW_PROXY_SECRET": SECRET,
            "KIROCREW_HOME": cls.tmp.name,
            "KIROCREW_APP_NAME": "html-studio",
            "HTML_STUDIO_NO_PICKER": "1",
            "HTML_STUDIO_NO_OPEN": "1",
        }
        cls.proc = subprocess.Popen([sys.executable, str(SERVER)], env=env,
                                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        deadline = time.time() + 5
        while time.time() < deadline:
            try:
                urllib.request.urlopen(f"{cls.base}/health", timeout=0.5)
                return
            except (urllib.error.URLError, ConnectionError):
                time.sleep(0.1)
        raise RuntimeError("server did not start")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.proc.terminate()
        cls.proc.wait(timeout=5)
        if cls.proc.stdout:
            cls.proc.stdout.close()
        cls.tmp.cleanup()

    def poll_build(self, job_id: str) -> dict:
        for _ in range(100):
            code, data = self.request("GET", f"/api/build?id={job_id}", signed=True)
            self.assertEqual(code, 200, data)
            if data["state"] != "running":
                return data
            time.sleep(0.05)
        self.fail("build job did not finish")

    def request(self, method: str, target: str, *, signed: bool, body: bytes = b"", ts: int | None = None):
        req = urllib.request.Request(self.base + target, data=body or None, method=method)
        if signed:
            req.add_header("X-KiroCrew-Proxy", sign(method, target, body, ts))
        try:
            with urllib.request.urlopen(req, timeout=2) as res:
                return res.status, json.loads(res.read() or b"{}")
        except urllib.error.HTTPError as e:
            with e:
                return e.code, json.loads(e.read() or b"{}")

    def test_health_is_unauthenticated(self) -> None:
        code, data = self.request("GET", "/health", signed=False)
        self.assertEqual(code, 200)
        self.assertEqual(data["status"], "ok")

    def test_unsigned_api_is_rejected(self) -> None:
        code, data = self.request("GET", "/api/status", signed=False)
        self.assertEqual(code, 401)
        self.assertEqual(data["error"], "invalid_proxy_signature")

    def test_stale_signature_is_rejected(self) -> None:
        code, _ = self.request("GET", "/api/status", signed=True, ts=int(time.time()) - 3600)
        self.assertEqual(code, 401)

    def test_signed_status(self) -> None:
        code, data = self.request("GET", "/api/status", signed=True)
        self.assertEqual(code, 200)
        self.assertEqual(data["app"], "html-studio")
        self.assertEqual(data["version"], "0.1.30")
        self.assertTrue(data["dataDir"].startswith(self.tmp.name))

    def test_signed_unknown_route_is_404(self) -> None:
        code, data = self.request("GET", "/api/nope", signed=True)
        self.assertEqual((code, data["error"], data["path"]), (404, "unknown_route", "/nope"))

    def test_data_dir_created(self) -> None:
        self.assertTrue((Path(self.tmp.name) / "apps" / "html-studio" / "data").is_dir())

    def test_roots_and_decks_flow(self) -> None:
        home = Path.home()
        with tempfile.TemporaryDirectory(dir=home) as root:
            slides = Path(root) / "my-deck" / "slides"
            slides.mkdir(parents=True)
            (slides / "010_cover.html").write_text("<section class='slide cover'></section>")

            body = json.dumps({"path": root}).encode()
            code, data = self.request("POST", "/api/roots/add", signed=True, body=body)
            self.assertEqual(code, 200, data)
            self.assertIn(str(Path(root).resolve()), data["roots"])

            code, data = self.request("GET", "/api/decks", signed=True)
            self.assertEqual(code, 200)
            names = [d["name"] for d in data["decks"]]
            self.assertIn("my-deck", names)

            code, data = self.request("POST", "/api/roots/remove", signed=True,
                                      body=json.dumps({"path": str(Path(root).resolve())}).encode())
            self.assertEqual(code, 200)
            self.assertEqual(data["roots"], [])

    def test_roots_add_rejects_bad_path(self) -> None:
        body = json.dumps({"path": "/definitely/not/here"}).encode()
        code, data = self.request("POST", "/api/roots/add", signed=True, body=body)
        self.assertEqual(code, 400)
        self.assertEqual(data["error"], "not_found")

    def test_roots_add_without_path_is_rejected(self) -> None:
        code, data = self.request("POST", "/api/roots/add", signed=True, body=b"{}")
        self.assertEqual((code, data["error"]), (400, "path_required"))

    def test_roots_pick_unsupported_here(self) -> None:
        code, data = self.request("POST", "/api/roots/pick", signed=True, body=b"{}")
        self.assertEqual((code, data["error"]), (400, "picker_unsupported"))
        code, data = self.request("GET", "/api/roots/pick?id=nope", signed=True)
        self.assertEqual((code, data["error"]), (404, "unknown_pick"))

    def test_preview_start_requires_registered_root(self) -> None:
        home = Path.home()
        with tempfile.TemporaryDirectory(dir=home) as root:
            deck = Path(root) / "deck"
            (deck / "slides").mkdir(parents=True)
            (deck / "slides" / "010.html").write_text("<section class='slide'>x</section>")
            body = json.dumps({"path": str(deck)}).encode()
            code, data = self.request("POST", "/api/preview/start", signed=True, body=body)
            self.assertEqual((code, data["error"]), (400, "deck_not_allowed"))

            self.request("POST", "/api/roots/add", signed=True, body=json.dumps({"path": root}).encode())
            code, data = self.request("POST", "/api/preview/start", signed=True, body=body)
            self.assertEqual(code, 200, data)
            self.assertGreater(data["port"], 0)
            self.assertEqual(data["slides"], ["010.html"])
            self.assertIsNone(data["css"])
            with urllib.request.urlopen(f"{data['baseUrl']}/slide/0", timeout=2) as r:
                self.assertIn(b"<section class='slide'>x</section>", r.read())

            code, data = self.request("POST", "/api/preview/stop", signed=True, body=body)
            self.assertEqual((code, data["stopped"]), (200, True))

            # Build: no studio.json -> builtin assembler, no consent needed.
            code, info = self.request("POST", "/api/build/info", signed=True, body=body)
            self.assertEqual((code, info["builtin"], info["trusted"]), (200, True, False))
            code, data = self.request("POST", "/api/build", signed=True, body=body)
            self.assertEqual((code, data["ok"], data["mode"]), (200, True, "builtin"), data)
            self.assertTrue((deck / "out" / "index.html").is_file())

            # External command: consent first; once trusted it runs as a job
            # (the proxy caps a request at ~30s, real build scripts run longer).
            (deck / "studio.json").write_text(json.dumps({"build": "mkdir -p out && echo x > out/index.html"}))
            code, data = self.request("POST", "/api/build", signed=True, body=body)
            self.assertEqual((code, data["ok"], data["needsTrust"], data["error"]), (200, False, True, "untrusted_command"))
            self.assertIn("mkdir", data["command"])
            trust_body = json.dumps({"path": str(deck), "trust": True}).encode()
            code, data = self.request("POST", "/api/build", signed=True, body=trust_body)
            self.assertEqual((code, data["state"]), (200, "running"), data)
            data = self.poll_build(data["job"])
            self.assertEqual((data["state"], data["result"]["ok"], data["result"]["mode"]), ("done", True, "external"), data)
            code, data = self.request("GET", "/api/build?id=nope", signed=True)
            self.assertEqual((code, data["error"]), (404, "unknown_job"))

            # Reveal refuses paths outside the deck.
            code, data = self.request("POST", "/api/reveal", signed=True,
                                      body=json.dumps({"path": str(deck), "file": "../secret"}).encode())
            self.assertEqual(code, 404)

            self.request("POST", "/api/roots/remove", signed=True,
                         body=json.dumps({"path": str(Path(root).resolve())}).encode())

    def test_design_md_read_and_tokens_written(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as root:
            deck = Path(root) / "deck"
            (deck / "slides").mkdir(parents=True)
            (deck / "slides" / "010.html").write_text("<section class='slide'><h1>x</h1></section>")
            self.request("POST", "/api/roots/add", signed=True, body=json.dumps({"path": root}).encode())
            q = "/api/design?path=" + urllib.parse.quote(str(deck))
            code, data = self.request("GET", q, signed=True)
            self.assertEqual((code, data["present"], data["tokensExists"]), (200, False, False))
            code, data = self.request("POST", "/api/design/tokens", signed=True, body=json.dumps({"path": str(deck)}).encode())
            self.assertEqual((code, data["error"]), (409, "no_design_md"))

            (deck / "DESIGN.md").write_text(
                "# Acme\n\n- **Teal** (`{colors.primary}` -- #0f766e)\n- **Paper** (`{colors.canvas-soft}` -- #f7f4ee)\n"
            )
            code, data = self.request("GET", q, signed=True)
            self.assertEqual((code, data["present"], data["design"]["name"]), (200, True, "Acme"))
            self.assertEqual(data["design"]["colors"]["primary"], "#0f766e")
            self.assertIsNone(data["css"])  # no stylesheet yet: default theme

            code, data = self.request("POST", "/api/design/tokens", signed=True, body=json.dumps({"path": str(deck)}).encode())
            self.assertEqual((code, data["tokensExists"], data["tokensStale"], data["css"]), (200, True, False, "tokens.css"))
            self.assertIn("--hs-accent: var(--color-primary)", (deck / "tokens.css").read_text())

            # The preview now renders the default theme WITH the tokens overlay.
            code, prev = self.request("POST", "/api/preview/start", signed=True, body=json.dumps({"path": str(deck)}).encode())
            self.assertEqual(code, 200)
            self.assertEqual(prev["css"], "tokens.css")
            page = urllib.request.urlopen(prev["baseUrl"] + "/slide/0").read().decode()
            self.assertIn("--hs-accent:#6d5efc", page)  # default theme inline
            self.assertLess(page.index("--hs-accent:#6d5efc"), page.index('href="/tokens.css"'))  # tokens win

            # Editing DESIGN.md marks tokens.css stale.
            (deck / "DESIGN.md").write_text("# Acme\n\n- **Teal** (`{colors.primary}` -- #000000)\n")
            code, data = self.request("GET", q, signed=True)
            self.assertTrue(data["tokensStale"])
            self.request("POST", "/api/preview/stop", signed=True, body=json.dumps({"path": str(deck)}).encode())
            self.request("POST", "/api/roots/remove", signed=True, body=json.dumps({"path": root}).encode())

    def test_pins_send_queue_report_dismiss(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as root:
            deck = Path(root) / "deck"
            (deck / "slides").mkdir(parents=True)
            (deck / "slides" / "010.html").write_text("<section class='slide'><h1>Title</h1></section>")
            self.request("POST", "/api/roots/add", signed=True, body=json.dumps({"path": root}).encode())
            pins = [{"id": "p1", "index": 1, "slideIndex": 0, "slideFile": "slides/010.html", "selector": "h1:nth-of-type(1)",
                     "tag": "h1", "classes": [], "text": "Title", "rect": {"x": 0, "y": 0, "w": 10, "h": 10}, "comment": "Shorter"}]
            code, data = self.request("POST", "/api/pins/send", signed=True, body=json.dumps({"path": str(deck), "pins": pins, "language": "ko"}).encode())
            self.assertEqual(code, 200, data)
            cid = data["comments"][0]["cid"]
            self.assertIn(data["file"], data["prompt"])
            self.assertIn("report.py", data["prompt"])
            self.assertIn("deck-visual-edit/SKILL.md", data["prompt"])
            self.assertTrue(Path(data["file"]).is_file())

            q = "/api/pins/queue?path=" + urllib.parse.quote(str(deck))
            code, qd = self.request("GET", q, signed=True)
            self.assertEqual((code, len(qd["batches"]), qd["batches"][0]["state"]), (200, 1, "sent"))

            # The agent reports through the CLI named in the prompt.
            r = subprocess.run([sys.executable, str(Path(__file__).resolve().parents[1] / "report.py"), "--batch", data["file"],
                                "--cid", cid, "--status", "done", "--text", "Shortened"], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            code, qd = self.request("GET", q, signed=True)
            b = qd["batches"][0]
            self.assertEqual((b["state"], b["comments"][0]["status"], b["comments"][0]["thread"][0]["text"]), ("done", "done", "Shortened"))

            code, dd = self.request("POST", "/api/pins/dismiss", signed=True, body=json.dumps({"path": str(deck), "id": b["id"]}).encode())
            self.assertEqual((code, dd["dismissed"]), (200, b["id"]))
            code, qd = self.request("GET", q, signed=True)
            self.assertEqual(qd["batches"], [])
            code, data = self.request("POST", "/api/pins/send", signed=True, body=json.dumps({"path": str(deck), "pins": []}).encode())
            self.assertEqual((code, data["error"]), (400, "no_pins"))
            self.request("POST", "/api/roots/remove", signed=True, body=json.dumps({"path": root}).encode())

    def test_source_routes_rebuild_and_conflict(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as root:
            deck = Path(root) / "deck"
            (deck / "slides").mkdir(parents=True)
            (deck / "slides" / "010.html").write_text("<section class='slide'><h1>One</h1></section>")
            (deck / "slides" / "020.html").write_text("<section class='slide'><h1>Two</h1></section>")
            self.request("POST", "/api/roots/add", signed=True, body=json.dumps({"path": root}).encode())
            q = "path=" + urllib.parse.quote(str(deck))
            code, src = self.request("GET", f"/api/source?{q}&slide=020.html", signed=True)
            self.assertEqual((code, src["kind"], src["file"], src["text"]), (200, "file", "slides/020.html", "<section class='slide'><h1>Two</h1></section>"))
            # Not built yet: a save writes the file and does not build.
            body = {"path": str(deck), "slide": "020.html", "text": "<section class='slide'><h1>Deux</h1></section>", "mtime": src["mtime"]}
            code, data = self.request("POST", "/api/source", signed=True, body=json.dumps(body).encode())
            self.assertEqual(code, 200)
            self.assertNotIn("rebuild", data)
            self.assertEqual((deck / "slides" / "020.html").read_text(), "<section class='slide'><h1>Deux</h1></section>")
            # Stale mtime: conflict, nothing written.
            code, data = self.request("POST", "/api/source", signed=True, body=json.dumps({**body, "text": "<section class='slide'>late</section>"}).encode())
            self.assertEqual((code, data["error"]), (409, "conflict"))
            self.assertEqual((deck / "slides" / "020.html").read_text(), "<section class='slide'><h1>Deux</h1></section>")
            # Build the deck, then a save rebuilds it (built-in build needs no consent).
            code, built = self.request("POST", "/api/build", signed=True, body=json.dumps({"path": str(deck)}).encode())
            self.assertEqual((code, built["ok"]), (200, True))
            out = deck / built["output"]
            self.assertIn("Deux", out.read_text())
            code, data = self.request("POST", "/api/source", signed=True, body=json.dumps({**body, "text": "<section class='slide'><h1>Drei</h1></section>", "mtime": None}).encode())
            self.assertEqual((code, data["rebuild"]["ok"]), (200, True))
            self.assertIn("Drei", out.read_text())
            code, data = self.request("POST", "/api/source", signed=True, body=json.dumps({"path": str(deck), "slide": "zzz.html", "text": "x"}).encode())
            self.assertEqual((code, data["error"]), (404, "unknown_slide"))

    def test_slides_arrange_routes(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as root:
            deck = Path(root) / "deck"
            (deck / "slides").mkdir(parents=True)
            for n in ("010_a", "020_b", "030_c"):
                (deck / "slides" / f"{n}.html").write_text(f"<section class='slide'><h1>{n}</h1></section>")
            self.request("POST", "/api/roots/add", signed=True, body=json.dumps({"path": root}).encode())
            post = lambda route, body: self.request("POST", f"/api/slides/{route}", signed=True, body=json.dumps({"path": str(deck), **body}).encode())  # noqa: E731
            code, data = post("reorder", {"order": ["030_c.html", "010_a.html", "020_b.html"]})
            self.assertEqual((code, data["slides"]), (200, ["005_c.html", "010_a.html", "020_b.html"]))
            self.assertNotIn("rebuild", data)
            code, data = post("reorder", {"order": ["005_c.html"]})
            self.assertEqual((code, data["error"]), (400, "bad_order"))
            code, data = post("add", {"after": "005_c.html"})
            self.assertEqual((code, data["name"], data["slides"]), (200, "007_new.html", ["005_c.html", "007_new.html", "010_a.html", "020_b.html"]))
            code, data = post("add", {"after": "020_b.html", "duplicate": True})
            self.assertEqual((code, data["name"]), (200, "030_b-copy.html"))
            code, data = post("archive", {"slide": "007_new.html"})
            self.assertEqual((code, data["file"], data["slides"]), (200, "archive/007_new.html", ["005_c.html", "010_a.html", "020_b.html", "030_b-copy.html"]))
            code, data = self.request("GET", "/api/slides/archive?path=" + urllib.parse.quote(str(deck)), signed=True)
            self.assertEqual((code, [i["name"] for i in data["items"]]), (200, ["007_new.html"]))
            # Built deck: a restore rebuilds.
            code, built = self.request("POST", "/api/build", signed=True, body=json.dumps({"path": str(deck)}).encode())
            self.assertEqual((code, built["ok"]), (200, True))
            code, data = post("restore", {"name": "007_new.html", "after": None})
            self.assertEqual((code, data["name"], data["rebuild"]["ok"]), (200, "040_new.html", True))
            self.assertEqual(data["slides"], ["005_c.html", "010_a.html", "020_b.html", "030_b-copy.html", "040_new.html"])
            self.assertIn("New slide", (deck / built["output"]).read_text())
            code, data = post("restore", {"name": "../x.html"})
            self.assertEqual((code, data["error"]), (404, "unknown_archive"))

    def test_layout_routes(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as root:
            deck = Path(root) / "deck"
            (deck / "slides").mkdir(parents=True)
            (deck / "slides" / "010_a.html").write_text("<section class='slide'><h1>Mine</h1><p>kept</p></section>")
            self.request("POST", "/api/roots/add", signed=True, body=json.dumps({"path": root}).encode())
            code, data = self.request("GET", "/api/layouts", signed=True)
            self.assertEqual(code, 200)
            self.assertEqual([i["id"] for i in data["items"]][:3], ["blank", "cover", "agenda"])
            # Add from a built-in layout: the file is named after it and holds its markup.
            code, data = self.request("POST", "/api/slides/add", signed=True, body=json.dumps({"path": str(deck), "after": "010_a.html", "layout": "kpi"}).encode())
            self.assertEqual((code, data["name"]), (200, "020_kpi.html"))
            self.assertIn("Key numbers", (deck / "slides" / "020_kpi.html").read_text())
            code, data = self.request("POST", "/api/slides/add", signed=True, body=json.dumps({"path": str(deck), "after": None, "layout": "nope"}).encode())
            self.assertEqual((code, data["error"]), (404, "unknown_layout"))
            # Save the first slide as a user layout, see it in the list, add from it, delete it.
            code, saved = self.request("POST", "/api/layouts", signed=True, body=json.dumps({"path": str(deck), "slide": "010_a.html", "name": "My opener"}).encode())
            self.assertEqual((code, saved["id"], saved["builtin"]), (200, "my-my-opener", False))
            code, data = self.request("GET", "/api/layouts", signed=True)
            self.assertIn("my-my-opener", [i["id"] for i in data["items"]])
            code, data = self.request("POST", "/api/slides/add", signed=True, body=json.dumps({"path": str(deck), "after": None, "layout": "my-my-opener"}).encode())
            self.assertEqual((code, data["name"]), (200, "030_my-opener.html"))
            self.assertIn("<p>kept</p>", (deck / "slides" / "030_my-opener.html").read_text())
            # The preview server renders layouts with the deck's stylesheet for thumbnails.
            code, pv = self.request("POST", "/api/preview/start", signed=True, body=json.dumps({"path": str(deck)}).encode())
            page = urllib.request.urlopen(f"{pv['baseUrl']}/layout/my-my-opener").read().decode()
            self.assertIn("<h1>Mine</h1>", page)
            with self.assertRaises(urllib.error.HTTPError):
                urllib.request.urlopen(f"{pv['baseUrl']}/layout/nope")
            code, data = self.request("POST", "/api/layouts/delete", signed=True, body=json.dumps({"id": "my-my-opener"}).encode())
            self.assertEqual(code, 200)
            code, data = self.request("POST", "/api/layouts/delete", signed=True, body=json.dumps({"id": "cover"}).encode())
            self.assertEqual((code, data["error"]), (404, "unknown_layout"))
            # This test runs before test_roots_and_decks_flow (alphabetical), which expects no roots.
            self.request("POST", "/api/preview/stop", signed=True, body=json.dumps({"path": str(deck)}).encode())
            self.request("POST", "/api/roots/remove", signed=True, body=json.dumps({"path": root}).encode())

    def test_decks_new_route(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as root:
            body = {"root": root, "folder": "wizard-deck", "title": "Wizard deck", "presenter": "Sam", "purpose": "Try the wizard", "audience": "Team", "sources": "none", "theme": {"kind": "default"}}
            code, data = self.request("POST", "/api/decks/new", signed=True, body=json.dumps(body).encode())
            self.assertEqual((code, data["error"]), (400, "root_not_registered"))
            self.request("POST", "/api/roots/add", signed=True, body=json.dumps({"path": root}).encode())
            code, data = self.request("POST", "/api/decks/new", signed=True, body=json.dumps(body).encode())
            self.assertEqual((code, data["deck"]["name"], data["deck"]["slideCount"]), (200, "wizard-deck", 2))
            self.assertTrue((Path(root) / "wizard-deck" / "brief.md").is_file())
            code, data = self.request("POST", "/api/decks/new", signed=True, body=json.dumps(body).encode())
            self.assertEqual((code, data["error"]), (409, "exists"))
            code, data = self.request("POST", "/api/decks/new", signed=True, body=json.dumps({**body, "folder": "../escape"}).encode())
            self.assertEqual((code, data["error"]), (400, "bad_folder"))
            code, data = self.request("POST", "/api/decks/new", signed=True, body=json.dumps({**body, "folder": "no-title", "title": ""}).encode())
            self.assertEqual((code, data["error"]), (400, "missing_title"))
            code, data = self.request("POST", "/api/decks/new", signed=True, body=json.dumps({**body, "folder": "copy-deck", "theme": {"kind": "copy", "from": "/etc"}}).encode())
            self.assertEqual((code, data["error"]), (400, "bad_theme_source"))
            code, data = self.request("GET", "/api/decks", signed=True)
            self.assertIn("wizard-deck", [d["name"] for d in data["decks"]])
            self.request("POST", "/api/roots/remove", signed=True, body=json.dumps({"path": root}).encode())

    def test_tweak_routes(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as root:
            deck = Path(root) / "deck"
            (deck / "slides").mkdir(parents=True)
            (deck / "slides" / "010.html").write_text("<section class='slide'><h1>Hi</h1></section>")
            self.request("POST", "/api/roots/add", signed=True, body=json.dumps({"path": root}).encode())
            q = "path=" + urllib.parse.quote(str(deck))
            code, data = self.request("GET", f"/api/design/tweak?{q}", signed=True)
            self.assertEqual((code, data["hasDesign"], data["items"][0]["var"]), (200, False, "--hs-accent"))
            code, data = self.request("POST", "/api/design/tweak/preview", signed=True, body=json.dumps({"path": str(deck), "changes": {"--hs-accent": "#ff0000"}}).encode())
            self.assertEqual((code, data["error"]), (409, "no_preview"))
            code, pv = self.request("POST", "/api/preview/start", signed=True, body=json.dumps({"path": str(deck)}).encode())
            code, data = self.request("POST", "/api/design/tweak/preview", signed=True, body=json.dumps({"path": str(deck), "changes": {"--hs-accent": "#ff0000"}}).encode())
            self.assertEqual((code, data["count"]), (200, 1))
            page = urllib.request.urlopen(f"{pv['baseUrl']}/slide/0").read().decode()
            self.assertIn(":root{--hs-accent:#ff0000!important;}", page)
            code, data = self.request("POST", "/api/design/tweak", signed=True, body=json.dumps({"path": str(deck), "changes": {"--hs-accent": "#ff0000"}}).encode())
            self.assertEqual((code, data["created"], data["css"], data["designInfo"]["present"]), (200, True, "tokens.css", True))
            self.assertIn("--color-primary: #ff0000;", (deck / "tokens.css").read_text())
            # The preview now serves tokens.css and carries no overrides.
            code, pv = self.request("POST", "/api/preview/start", signed=True, body=json.dumps({"path": str(deck)}).encode())
            self.assertEqual(pv["css"], "tokens.css")
            page = urllib.request.urlopen(f"{pv['baseUrl']}/slide/0").read().decode()
            self.assertNotIn("!important;}", page)
            self.assertIn('href="/tokens.css"', page)
            code, data = self.request("POST", "/api/design/tweak", signed=True, body=json.dumps({"path": str(deck), "changes": {"--color-primary": "nope"}}).encode())
            self.assertEqual((code, data["error"]), (400, "bad_colour"))
            self.request("POST", "/api/preview/stop", signed=True, body=json.dumps({"path": str(deck)}).encode())
            self.request("POST", "/api/roots/remove", signed=True, body=json.dumps({"path": root}).encode())

    def test_notes_round_trip_and_orphans(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as root:
            deck = Path(root) / "deck"
            (deck / "slides").mkdir(parents=True)
            (deck / "slides" / "010.html").write_text("<section class='slide'>a</section>")
            (deck / "slides" / "020.html").write_text("<section class='slide'>b</section>")
            self.request("POST", "/api/roots/add", signed=True, body=json.dumps({"path": root}).encode())
            q = "path=" + urllib.parse.quote(str(deck))
            code, data = self.request("GET", f"/api/notes?{q}", signed=True)
            self.assertEqual((code, data), (200, {"withNotes": [], "orphans": [], "dir": "notes"}))
            code, data = self.request("GET", f"/api/note?{q}&slide=010.html", signed=True)
            self.assertEqual((code, data["text"], data["file"]), (200, "", "notes/010.md"))
            code, data = self.request("POST", "/api/note", signed=True, body=json.dumps({"path": str(deck), "slide": "010.html", "text": "- hello"}).encode())
            self.assertEqual((code, data["exists"]), (200, True))
            self.assertEqual((deck / "notes" / "010.md").read_text(), "- hello\n")
            (deck / "notes" / "030.md").write_text("orphan")
            code, data = self.request("GET", f"/api/notes?{q}", signed=True)
            self.assertEqual((data["withNotes"], data["orphans"]), (["010.html"], ["030.md"]))
            code, data = self.request("POST", "/api/note", signed=True, body=json.dumps({"path": str(deck), "slide": "nope.html", "text": "x"}).encode())
            self.assertEqual((code, data["error"]), (404, "unknown_slide"))
            code, data = self.request("POST", "/api/note", signed=True, body=json.dumps({"path": str(deck), "slide": "010.html", "text": ""}).encode())
            self.assertEqual((code, data["exists"]), (200, False))
            self.assertFalse((deck / "notes" / "010.md").exists())
            self.request("POST", "/api/roots/remove", signed=True, body=json.dumps({"path": root}).encode())

    def test_check_job_runs_all_rules(self) -> None:
        sys.path.insert(0, str(REPO / "backend"))
        if not __import__("export").find_browser():
            self.skipTest("no headless browser")
        with tempfile.TemporaryDirectory(dir=Path.home()) as root:
            deck = Path(root) / "deck"
            (deck / "slides").mkdir(parents=True)
            (deck / "slides" / "010.html").write_text("<section class='slide'><p style='font-size:9px'>SECTION 01</p><h1>Hello \u2014 world</h1></section>")
            (deck / "studio.json").write_text(json.dumps({"check": {"disable": ["inline-font-size"]}}))
            self.request("POST", "/api/roots/add", signed=True, body=json.dumps({"path": root}).encode())
            code, data = self.request("POST", "/api/check", signed=True, body=json.dumps({"path": str(deck)}).encode())
            self.assertEqual((code, data["state"]), (200, "running"))
            for _ in range(200):
                code, st = self.request("GET", f"/api/check?id={data['id']}", signed=True)
                if st["state"] != "running":
                    break
                time.sleep(0.1)
            self.assertEqual(st["state"], "done", st)
            res = st["result"]
            rules = [i["rule"] for i in res["issues"]]
            self.assertIn("punctuation", rules)
            self.assertIn("missing-cover", rules)
            self.assertNotIn("inline-font-size", rules)  # disabled via studio.json
            self.assertEqual(res["disabled"], ["inline-font-size"])
            self.assertEqual(res["slides"], 1)
            self.assertTrue(all(i["slideFile"] == "010.html" for i in res["issues"]))
            self.assertEqual(res["counts"]["punctuation"], 1)
            code, st = self.request("GET", "/api/check?id=nope", signed=True)
            self.assertEqual((code, st["error"]), (404, "unknown_job"))
            self.request("POST", "/api/preview/stop", signed=True, body=json.dumps({"path": str(deck)}).encode())
            self.request("POST", "/api/roots/remove", signed=True, body=json.dumps({"path": root}).encode())

    def test_present_and_pdf_require_output(self) -> None:
        home = Path.home()
        with tempfile.TemporaryDirectory(dir=home) as root:
            deck = Path(root) / "deck"
            (deck / "slides").mkdir(parents=True)
            (deck / "slides" / "010.html").write_text("<section class='slide'>x</section>")
            self.request("POST", "/api/roots/add", signed=True, body=json.dumps({"path": root}).encode())
            body = json.dumps({"path": str(deck)}).encode()
            code, data = self.request("POST", "/api/present", signed=True, body=body)
            self.assertEqual((code, data["error"]), (409, "no_output"))
            # PDF no longer needs a build: it renders the preview's /print document.
            code, data = self.request("POST", "/api/pdf", signed=True, body=body)
            if code == 200:
                self.assertEqual(data["state"], "running")
            else:
                self.assertEqual(data["error"], "no_browser")
            code, data = self.request("GET", "/api/pdf?id=nope", signed=True)
            self.assertEqual((code, data["error"]), (404, "unknown_job"))
            self.request("POST", "/api/roots/remove", signed=True,
                         body=json.dumps({"path": str(Path(root).resolve())}).encode())


if __name__ == "__main__":
    unittest.main()
