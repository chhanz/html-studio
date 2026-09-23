"""Deck builds.

Two build paths:

* **External** — ``studio.json`` declares ``build`` (a shell command run inside
  the deck folder) and ``output`` (the produced entry HTML, default
  ``out/index.html``). Because that command is arbitrary text shipped with the
  deck, it runs only after the user has trusted its exact text once; the
  trusted hash is remembered per deck in the app config.
* **Built-in** — no ``build`` declared: the app assembles ``slides/*.html``
  into ``out/index.html`` with the default theme and a minimal runtime.

Either way the result is ``{ok, output, durationMs, issues[], stdout, stderr}``
where ``issues`` are ``<file>: <message>`` lines parsed from the tool output.
"""
from __future__ import annotations

import hashlib
import html
import json
import os
import re
import subprocess
import time
from pathlib import Path
from typing import Any

import decks as deck_lib
import preview as preview_lib

BUILD_TIMEOUT_SEC = 120
DEFAULT_OUTPUT = "out/index.html"
_ISSUE_RE = re.compile(r"^\s*(?P<file>[\w.\-]+\.html)\s*:\s*(?P<message>.+?)\s*$")
_MAX_LOG = 20_000


class BuildError(ValueError):
    def __init__(self, code: str, message: str = "") -> None:
        super().__init__(message or code)
        self.code = code


# ------------------------------------------------------------- contract
def build_contract(deck: Path, entry: str | None = None) -> dict[str, Any]:
    """Resolve build settings for *deck* from studio.json + defaults.

    For a single-file deck (``entry`` set) with no declared command the file IS
    the output: nothing to assemble, so ``buildable`` is False.
    """
    studio = deck_lib._read_studio(deck) or {}
    command = studio.get("build")
    command = command.strip() if isinstance(command, str) and command.strip() else None
    output = studio.get("output")
    output = output.strip() if isinstance(output, str) and output.strip() else (entry or DEFAULT_OUTPUT)
    if not _inside(deck, output):
        output = entry or DEFAULT_OUTPUT
    builtin = command is None and entry is None
    return {
        "command": command,
        "output": output,
        "outputExists": (deck / output).is_file(),
        "builtin": builtin,
        "buildable": command is not None or builtin,
        "singleFile": entry is not None,
        "commandHash": command_hash(command) if command else None,
    }


def _inside(deck: Path, rel: str) -> bool:
    try:
        (deck / rel).resolve().relative_to(deck.resolve())
        return True
    except ValueError:
        return False


def command_hash(command: str) -> str:
    return hashlib.sha256(command.encode("utf-8")).hexdigest()[:16]


# ---------------------------------------------------------------- trust
def _trusted(config: dict[str, Any]) -> dict[str, str]:
    t = config.get("trustedBuilds")
    return t if isinstance(t, dict) else {}


def is_trusted(data_dir: Path, deck: Path, command: str) -> bool:
    return _trusted(deck_lib.load_config(data_dir)).get(str(deck.resolve())) == command_hash(command)


def trust(data_dir: Path, deck: Path, command: str) -> None:
    config = deck_lib.load_config(data_dir)
    trusted = dict(_trusted(config))
    trusted[str(deck.resolve())] = command_hash(command)
    config["trustedBuilds"] = trusted
    deck_lib.save_config(data_dir, config)


# ------------------------------------------------------------- parsing
def parse_issues(text: str) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for line in text.splitlines():
        m = _ISSUE_RE.match(line)
        if not m:
            continue
        key = (m.group("file"), m.group("message"))
        if key not in seen:
            seen.add(key)
            issues.append({"file": key[0], "message": key[1]})
    return issues


def _clip(s: str) -> str:
    return s if len(s) <= _MAX_LOG else s[-_MAX_LOG:]


# -------------------------------------------------------------- runners
def run_external(deck: Path, command: str, output: str) -> dict[str, Any]:
    env = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "USER")}
    started = time.monotonic()
    try:
        proc = subprocess.run(
            command, shell=True, cwd=str(deck), env=env, capture_output=True, text=True,
            timeout=BUILD_TIMEOUT_SEC, stdin=subprocess.DEVNULL, check=False,
        )
        code, out, err = proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired as exc:
        code = -1
        out = (exc.stdout or b"").decode(errors="replace") if isinstance(exc.stdout, bytes) else (exc.stdout or "")
        err = f"build timed out after {BUILD_TIMEOUT_SEC}s"
    duration = int((time.monotonic() - started) * 1000)
    ok = code == 0 and (deck / output).is_file()
    return {
        "ok": ok,
        "mode": "external",
        "exitCode": code,
        "output": output if (deck / output).is_file() else None,
        "durationMs": duration,
        "issues": parse_issues(out + "\n" + err),
        "stdout": _clip(out),
        "stderr": _clip(err),
    }


_RUNTIME_JS = """
(function(){var s=[].slice.call(document.querySelectorAll('.slide')),i=0;
function show(n){i=Math.max(0,Math.min(s.length-1,n));s.forEach(function(e,k){e.classList.toggle('active',k===i)});
var c=document.getElementById('hs-counter');if(c)c.textContent=(i+1)+' / '+s.length;history.replaceState(null,'',location.pathname+location.search+'#'+(i+1));if(parent!==window)parent.postMessage({type:'hs-slide',index:i,total:s.length},'*');}
function fit(){var st=document.querySelector('.hs-stage');if(!st)return;var k=Math.min(innerWidth/1280,innerHeight/720);st.style.transform='scale('+k+')';}
function full(){var d=document.documentElement;if(document.fullscreenElement)document.exitFullscreen&&document.exitFullscreen();else if(d.requestFullscreen)d.requestFullscreen().catch(function(){});}
addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' ')show(i+1);
else if(e.key==='ArrowLeft'||e.key==='PageUp')show(i-1);else if(e.key==='Home')show(0);else if(e.key==='End')show(s.length-1);
else if((e.key==='f'||e.key==='F')&&parent===window)full();else if(e.key==='p'||e.key==='P')print();else if(e.key==='Escape'&&parent!==window)parent.postMessage({type:'hs-exit'},'*');});
addEventListener('message',function(e){var m=e.data||{};if(m.type==='hs-go')show((m.index|0));else if(m.type==='hs-step')show(i+(m.delta|0));else if(m.type==='hs-fullscreen')full();});
addEventListener('hashchange',function(){var h=parseInt(location.hash.slice(1),10);if(!isNaN(h))show(h-1);});
addEventListener('resize',fit);var h=parseInt(location.hash.slice(1),10);show(isNaN(h)?0:h-1);fit();})();
"""


_CLASS_RE = re.compile(r"""\bclass=(?P<q>["'])(?P<v>.*?)(?P=q)""", re.S)


def _strip_active(fragment: str) -> str:
    """Remove the ``active`` token from every class attribute; the runtime owns it."""
    def repl(m: re.Match[str]) -> str:
        tokens = [t for t in m.group("v").split() if t != "active"]
        return f'class={m.group("q")}{" ".join(tokens)}{m.group("q")}'
    return _CLASS_RE.sub(repl, fragment)


def run_builtin(deck: Path, slides_dir: str, output: str, css_rel: str | None = None) -> dict[str, Any]:
    """Assemble slides into one page with the deck's stylesheet (or the default theme) and a tiny runtime.

    ``css_rel`` is a deck-relative stylesheet (e.g. ``assets/deck.css``). The
    output lives in a subfolder, so a ``<base>`` pointing at the deck root keeps
    the slides' relative ``img/...`` references and the stylesheet's ``url()``s working.
    """
    started = time.monotonic()
    slides = sorted(p for p in (deck / slides_dir).glob("*.html") if p.is_file())
    if not slides:
        return {"ok": False, "mode": "builtin", "exitCode": 1, "output": None, "durationMs": 0,
                "issues": [], "stdout": "", "stderr": "no slide files found"}
    issues: list[dict[str, str]] = []
    parts: list[str] = []
    for p in slides:
        frag = p.read_text(encoding="utf-8", errors="replace")
        n = len(re.findall(r"<section\b", frag))
        if n != 1:
            issues.append({"file": p.name, "message": f"expected exactly 1 <section>, found {n}"})
        parts.append(_strip_active(frag).rstrip())
    if issues:
        return {"ok": False, "mode": "builtin", "exitCode": 1, "output": None,
                "durationMs": int((time.monotonic() - started) * 1000), "issues": issues,
                "stdout": "", "stderr": "slide validation failed"}
    target = deck / output
    depth = len(Path(output).parent.parts)
    base_href = "../" * depth if depth else "./"
    if css_rel and (deck / css_rel).is_file():
        theme = f'<link rel="stylesheet" href="{html.escape(css_rel, quote=True)}">'
        if css_rel != "tokens.css" and (deck / "tokens.css").is_file():
            theme = '<link rel="stylesheet" href="tokens.css">' + theme  # variables layer under the deck css
        css = ""
    else:
        theme = ""
        css = preview_lib.default_theme_css()
    body = "\n".join(parts)
    page = (
        '<!doctype html><html><head><meta charset="utf-8">'
        f'<base href="{base_href}">'
        f"<title>{html.escape(deck.name)}</title>{theme}"
        f"<style>{css}\nhtml,body{{height:100%;background:#111;overflow:hidden}}"
        ".hs-stage{position:absolute;left:50%;top:50%;width:1280px;height:720px;margin:-360px 0 0 -640px;transform-origin:center center;background:#fff}"
        ".hs-stage>.slide{display:none;position:absolute;inset:0}.hs-stage>.slide.active{display:flex;animation:none}"
        "#hs-counter{position:fixed;right:12px;bottom:8px;color:#888;font:12px monospace}"
        # Print: undo the screen layout so every slide is one full page and the
        # runtime chrome (dark backdrop, counter) never reaches the PDF.
        "@media print{@page{size:1280px 720px;margin:0}"
        "html,body{width:1280px;height:auto!important;overflow:visible!important;background:#fff!important}"
        ".hs-stage{position:static!important;margin:0!important;transform:none!important;width:1280px;height:auto!important;background:transparent}"
        ".hs-stage>.slide{display:flex!important;position:relative!important;inset:auto!important;width:1280px;height:720px;"
        "break-after:page;page-break-after:always;break-inside:avoid;animation:none!important}"
        ".hs-stage>.slide:last-child{break-after:auto;page-break-after:auto}"
        "#hs-counter{display:none!important}}</style></head>"
        # `.stage` alias: deck stylesheets commonly scope their own print rules to it.
        f'<body><div class="hs-stage stage">{body}</div><div id="hs-counter"></div>'
        f"<script>{_RUNTIME_JS}</script></body></html>"
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(page, encoding="utf-8")
    return {"ok": True, "mode": "builtin", "exitCode": 0, "output": output,
            "durationMs": int((time.monotonic() - started) * 1000), "issues": [],
            "stdout": f"assembled {len(slides)} slides into {output}", "stderr": ""}


def build(
    data_dir: Path, deck: Path, slides_dir: str, *, trust_command: bool = False,
    entry: str | None = None, css_rel: str | None = None,
) -> dict[str, Any]:
    """Run the deck's build. Raises BuildError('untrusted_command') when consent is needed."""
    contract = build_contract(deck, entry)
    command = contract["command"]
    if command is None:
        if not contract["buildable"]:
            raise BuildError("not_buildable", "single-file deck has nothing to assemble")
        return run_builtin(deck, slides_dir, contract["output"], css_rel)
    if trust_command:
        trust(data_dir, deck, command)
    elif not is_trusted(data_dir, deck, command):
        raise BuildError("untrusted_command", command)
    return run_external(deck, command, contract["output"])
