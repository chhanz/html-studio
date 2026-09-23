---
name: deck-visual-edit
description: Apply pinned comments from HTML Studio to an HTML slide deck. Use when a chat message announces a "Visual edit batch" with a batch .json path. Edit the slide source files one comment at a time, keep every slide inside its 1280x720 stage, follow the deck's DESIGN.md / tokens.css, and report each comment with report.py.
---

# Deck visual edit

You are attached to an HTML slide deck (this session's project directory is the
deck folder). HTML Studio sends you a **batch**: a JSON file listing comments the
user pinned on elements of the preview. Your job is to make each change in the
slide source and report each one.

## Read the batch

The chat message gives the absolute path of `<batch>.json`. Read it; never write
to it. Each entry in `comments` has:

| field | meaning |
|---|---|
| `cid` | id you report with; also the value to put in `data-studio-cid` |
| `slideFile`, `slidePath` | the slide source file (a `<section class="slide">` fragment, or the single-file deck) |
| `selector` | CSS selector relative to that `<section class="slide">` |
| `tag`, `elementId`, `classes`, `text` | what the user clicked; `text` is a trimmed excerpt |
| `rect` | where it sits on the 1280x720 stage (x, y, w, h) |
| `existingCid` | a `data-studio-cid` the element already carries, if any |
| `comment` | what the user wants |

Locate the element with `selector` inside the slide's `<section>`; confirm with
`text`/`classes`. If the selector no longer matches (the file changed), use
`text` and `rect` to find the intended element. If genuinely ambiguous, report a
`question` instead of guessing.

## Make the change

- Edit the **slide source** files only. Never edit build output (`out/`), the
  preview, `tokens.css` or the batch file.
- Keep the slide inside its stage: 1280x720, nothing overflowing. If a change
  needs more room, tighten spacing or shorten text rather than growing the slide.
- Follow the deck's design system: if the deck has `DESIGN.md` / `tokens.css`,
  use its CSS variables (`--color-<name>`, `--font-sans`, `--space-<name>`,
  `--radius-<name>`, `--type-<name>-size`...) and its component classes instead
  of hard-coded values or new inline styles.
- Prefer the deck's existing classes over new inline styles. If you must add a
  rule, put it in the deck stylesheet, not in the slide.
- Mark what you touched: add `data-studio-cid="<cid>"` to the element you
  changed (or created) so the studio can find it again. Keep an `existingCid`
  if the element already has one.
- Do not rename, reorder or delete slide files as part of a comment unless the
  comment asks for exactly that.
- Speaker notes belong in `notes/<slide>.md`, never inside slide HTML.
- Do not use em dashes or en dashes in slide text you write; use plain punctuation.

## Report after EACH comment

Exactly one command per comment, right after you finish it:

```
python3 "<report.py path from the message>" --batch "<batch.json>" --cid <cid> --status done --text "<one line: what changed>"
```

If you cannot proceed (unclear intent, contradictory with the design, element
gone):

```
python3 "<report.py>" --batch "<batch.json>" --cid <cid> --status question --text "<the question, one line>"
```

Never skip a report, never report a cid you did not handle, and do not batch
several reports into one. The studio watches these reports to update the pins
and reload the preview.

## Chat replies

Keep chat replies to one or two lines in the user's language; the reports carry
the detail. When all comments are handled, say so in one line.
