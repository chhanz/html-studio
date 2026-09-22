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
        self.assertEqual(data["version"], "0.1.0")
        self.assertTrue(data["dataDir"].startswith(self.tmp.name))

    def test_signed_unknown_route_is_404(self) -> None:
        code, data = self.request("GET", "/api/nope", signed=True)
        self.assertEqual(code, 404)
        self.assertEqual(data["path"], "/nope")

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

    def test_roots_add_without_path_and_picker_disabled(self) -> None:
        code, data = self.request("POST", "/api/roots/add", signed=True, body=b"{}")
        self.assertEqual(code, 400)
        self.assertEqual(data["error"], "picker_unsupported")

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
            self.request("POST", "/api/roots/remove", signed=True,
                         body=json.dumps({"path": str(Path(root).resolve())}).encode())


if __name__ == "__main__":
    unittest.main()
