#!/usr/bin/env python3
"""Report progress on one pinned comment of an HTML Studio visual-edit batch.

Used by the agent (see skills/deck-visual-edit/SKILL.md):

    python3 report.py --batch /path/to/<batch>.json --cid <cid> --status done --text "Removed bold"
    python3 report.py --batch /path/to/<batch>.json --cid <cid> --status question --text "Which line?"

Appends one JSON line to <batch>.replies.jsonl next to the batch file. The
batch file itself is never modified. Exit code 0 on success, 2 on bad input.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pinqueue as queue_lib  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--batch", required=True, help="path to the batch .json file given in the chat message")
    ap.add_argument("--cid", required=True, help="comment id from the batch, e.g. 66f1a2b3c4d5-1")
    ap.add_argument("--status", required=True, choices=("done", "question"))
    ap.add_argument("--text", required=True, help="one line: what changed, or the question")
    args = ap.parse_args(argv)

    batch_file = Path(args.batch).expanduser().resolve()
    batch = queue_lib.load_batch(batch_file)
    if batch is None:
        print(f"report: not a batch file: {batch_file}", file=sys.stderr)
        return 2
    if args.cid not in {c["cid"] for c in batch["comments"]}:
        print(f"report: unknown cid {args.cid!r}; batch has: {', '.join(c['cid'] for c in batch['comments'])}", file=sys.stderr)
        return 2
    rec = queue_lib.append_reply(batch_file, args.cid, args.status, args.text)
    print(json.dumps(rec, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
