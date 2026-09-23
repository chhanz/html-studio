"""Visual-edit batches: pins sent to the agent, and the agent's per-comment replies.

Files (under the app data dir, never inside the deck):

    queue/<batch id>.json            the batch, written ONCE by the studio
    queue/<batch id>.replies.jsonl   one line per report, appended by report.py

The agent never edits the batch file; it reports through ``report.py`` (a tiny
stdlib CLI shipped next to this module) so no HTTP, token or signature is
involved. ``load_batch`` merges the replies into each comment's status/thread.
"""
from __future__ import annotations

import json
import re
import secrets
import time
from pathlib import Path
from typing import Any

BATCH_TYPE = "visual_edit_batch"
STATUSES = ("new", "sent", "done", "question")
_ID_RE = re.compile(r"^[a-z0-9]{6,32}$")


def new_batch_id() -> str:
    return f"{int(time.time()):x}{secrets.token_hex(2)}"


def batch_path(queue_dir: Path, batch_id: str) -> Path:
    if not _ID_RE.match(batch_id):
        raise ValueError("bad batch id")
    return queue_dir / f"{batch_id}.json"


def replies_path(batch_file: Path) -> Path:
    return batch_file.with_suffix(".replies.jsonl")


def make_batch(deck: Path, deck_name: str, pins: list[dict[str, Any]], language: str) -> dict[str, Any]:
    """Turn the UI's pins into a batch. Each comment gets a server-issued ``cid``
    the agent reports with and adds to the element as ``data-studio-cid``."""
    bid = new_batch_id()
    comments = []
    for n, p in enumerate(pins, start=1):
        slide_file = str(p.get("slideFile") or "")
        comments.append(
            {
                "cid": f"{bid}-{n}",
                "index": int(p.get("index") or n),
                "pinId": str(p.get("id") or ""),
                "status": "sent",
                "comment": str(p.get("comment") or "").strip(),
                "slideIndex": int(p.get("slideIndex") or 0),
                "slideFile": slide_file,
                "slidePath": str((deck / slide_file).resolve()) if slide_file else "",
                "existingCid": p.get("cid") or None,
                "selector": str(p.get("selector") or ""),
                "tag": str(p.get("tag") or ""),
                "elementId": p.get("elementId") or None,
                "classes": [str(c) for c in (p.get("classes") or [])],
                "text": str(p.get("text") or ""),
                "rect": p.get("rect") or None,
                "src": p.get("src") or None,
                "thread": [],
            }
        )
    return {
        "type": BATCH_TYPE,
        "id": bid,
        "deck": deck_name,
        "deckPath": str(deck.resolve()),
        "language": language,
        "createdAt": int(time.time()),
        "state": "sent",
        "comments": comments,
    }


def write_batch(queue_dir: Path, batch: dict[str, Any]) -> Path:
    queue_dir.mkdir(parents=True, exist_ok=True)
    path = batch_path(queue_dir, batch["id"])
    path.write_text(json.dumps(batch, ensure_ascii=False, indent=1), encoding="utf-8")
    return path


def append_reply(batch_file: Path, cid: str, status: str, text: str, role: str = "agent") -> dict[str, Any]:
    """One JSON line per message on a comment: the agent's reports (report.py,
    status done/question) and the user's answers (status back to sent)."""
    if role == "agent" and status not in ("done", "question"):
        raise ValueError("status must be done or question")
    if role == "user" and status != "sent":
        raise ValueError("a user reply puts the comment back to sent")
    rec = {"cid": cid, "role": role, "status": status, "text": text.strip(), "ts": int(time.time())}
    with replies_path(batch_file).open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return rec


def load_batch(batch_file: Path) -> dict[str, Any] | None:
    try:
        batch = json.loads(batch_file.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    by_cid = {c["cid"]: c for c in batch.get("comments", [])}
    for c in by_cid.values():
        c["thread"] = []
        c["status"] = "sent"
    rp = replies_path(batch_file)
    if rp.is_file():
        for line in rp.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            c = by_cid.get(str(rec.get("cid")))
            if c is None:
                continue
            role = "user" if rec.get("role") == "user" else "agent"
            c["thread"].append({"role": role, "text": str(rec.get("text") or ""), "ts": rec.get("ts")})
            if rec.get("status") in ("done", "question", "sent"):
                c["status"] = rec["status"]
    comments = list(by_cid.values())
    batch["state"] = "done" if comments and all(c["status"] in ("done", "question") for c in comments) else "sent"
    return batch


def list_batches(queue_dir: Path, deck: Path) -> list[dict[str, Any]]:
    if not queue_dir.is_dir():
        return []
    want = str(deck.resolve())
    out = []
    for f in sorted(queue_dir.glob("*.json")):
        b = load_batch(f)
        if b and b.get("type") == BATCH_TYPE and b.get("deckPath") == want:
            out.append(b)
    return out


def build_prompt(batch: dict[str, Any], batch_file: Path, skill_file: Path, report_script: Path) -> str:
    """The message sent to the deck's chat session."""
    lang = "Korean" if str(batch.get("language", "")).startswith("ko") else "English"
    n = len(batch["comments"])
    lines = [
        f"Visual edit batch {batch['id']}: {n} pinned comment{'s' if n != 1 else ''} on deck \"{batch['deck']}\".",
        "",
        f"1. Read the skill first: {skill_file}",
        f"2. Read the batch (do NOT modify this file): {batch_file}",
        "3. Handle the comments in order. Each names the slide file, a CSS selector relative to the",
        "   <section class=\"slide\">, the element's tag/classes/text and its stage rect (1280x720).",
        "4. After EACH comment, report with exactly one command:",
        f'   python3 "{report_script}" --batch "{batch_file}" --cid <cid> --status done --text "<one line: what changed>"',
        f'   python3 "{report_script}" --batch "{batch_file}" --cid <cid> --status question --text "<what you need to know>"',
        "   Never skip a report and never report a cid you did not handle.",
        "",
        "Comments:",
    ]
    for c in batch["comments"]:
        where = f"{c['slideFile']} > {c['selector']}" if c["selector"] else c["slideFile"]
        snippet = f' "{c["text"]}"' if c.get("text") else ""
        lines.append(f"- [{c['cid']}] {where}{snippet}: {c['comment'] or '(no comment: look at the element and improve it)'}")
    lines += ["", f"Answer in {lang}. Keep chat replies to one or two lines; the reports carry the detail."]
    return "\n".join(lines)
