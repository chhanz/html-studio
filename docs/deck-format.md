# Deck format

HTML Studio works on plain folders. It adds no runtime to your slides and reads a handful of optional files. This page is the complete list of what it looks for and what it writes.

## Two shapes of deck

**Split deck** (recommended). A folder with a `slides/` directory holding one HTML file per slide:

```
my-deck/
  slides/
    010_cover.html
    020_agenda.html
    030_uptime.html
  img/
  assets/deck.css        (optional, your stylesheet)
  studio.json            (optional)
```

Each file is a fragment: one `<section class="slide">…</section>`. Slides are ordered by file name, so a numeric prefix (`010_`, `020_`) keeps them in order and leaves room to insert. Anything else in the folder (images, fonts, CSS) is served as is, relative to the deck root.

**Single-file deck.** One `index.html` (or the only `*.html` in the folder) with several top-level `<section class="slide">` blocks. HTML Studio treats each block as a slide; edits are spliced back into the document. There is no build step for this shape: the file is already the output.

A folder is recognised as a deck when it has `studio.json`, a `slides/` directory with at least one `.html` file, or a single HTML file with slide sections.

## The stage

Every slide is laid out on a 1280 x 720 stage. The preview, the checks, the presenter and the PDF all use this size; a deck that fits the stage fits everywhere.

## `studio.json`

Optional. Every key is optional.

```json
{
  "slidesDir": "slides",
  "css": "assets/deck.css",
  "build": "sh ./build.sh",
  "output": "out/index.html",
  "check": { "disable": ["punctuation"] },
  "title": "Acme Quarterly Review",
  "presenter": "Jamie Lee",
  "purpose": "Agree the Q4 priorities",
  "audience": "Acme leadership"
}
```

| Key | Meaning |
|---|---|
| `slidesDir` | folder holding the slide fragments (default `slides`) |
| `css` | the deck stylesheet, relative to the deck. Without it, HTML Studio looks for `assets/deck.css`, `deck.css`, then `tokens.css`, and otherwise applies its built-in theme |
| `build` | an external command that assembles the deck. It is never run until you approve it once in the studio; the approval is remembered per deck and command. The command runs in the deck folder in the background (up to two minutes) and is run again after every edit the studio makes once the output exists |
| `output` | where the built deck lands (default `out/index.html`). Shown in the Built output view. Present shows it when a `build` command made it; without a command, Present shows the slides assembled live from the current files, so no build is needed |
| `check.disable` | check rules to skip for this deck (see below) |
| `title`, `presenter`, `purpose`, `audience` | deck metadata written by the new deck wizard; informational |

If the deck root holds a `build.sh`, `rebuild.sh`, `make.sh` or `Makefile` that `studio.json` does not declare, the studio offers it; accepting writes the command into `studio.json`, and the usual one-time approval follows.

Without `build`, a split deck is assembled by the built-in assembler: every fragment in order, wrapped in one document with the deck stylesheet and a small runtime for keyboard navigation and hash-based slide addressing (`#3`).

## `DESIGN.md` and `tokens.css`

A deck can carry its design as a `DESIGN.md` in the [DESIGN.md format](https://github.com/VoltAgent/awesome-design-md): colours, typography, spacing and radii, either as YAML front matter or as prose and tables. HTML Studio reads it to show the palette, to drive the theme panel, and to generate `tokens.css`: CSS custom properties (`--color-<name>`, `--font-sans`, `--space-<name>`, `--radius-<name>`, `--type-<name>-size/weight/leading/tracking`) plus a few hooks the built-in theme reads (`--hs-accent`, `--hs-bg`, `--hs-fg`, `--hs-muted`, `--hs-border`, `--hs-cover`, `--hs-font`).

`tokens.css` is only written when you ask (the theme panel's Generate or Apply). When the deck has its own stylesheet, `tokens.css` is linked underneath it as a variables layer, so your CSS can use the variables and nothing else changes. When the deck has no stylesheet, `tokens.css` becomes its stylesheet and `studio.json` records that.

The theme panel writes back into the front matter of `DESIGN.md`; prose that repeats a colour next to its name is kept in step.

## Speaker notes: `notes/`

Notes live beside the slides, never inside them:

```
notes/020_agenda.md        for slides/020_agenda.html
notes/index-3.md           for the third section of a single-file deck
```

Plain Markdown, autosaved from the Notes panel, shown in the presenter window. A note whose slide is gone is listed as an orphan.

## Arranging slides

Reordering renames only the files that moved: a slide keeps its number when it is still in order, and a moved or new slide takes a free number between its neighbours (renumbering in steps of 10 only when there is no room). The part of the file name after the prefix never changes. Notes follow their slide.

Archiving moves a slide (and its note) into `archive/` inside the deck; nothing is deleted. Restore brings it back after the current slide.

## `brief.md`

Written by the new deck wizard: the title, purpose, audience and source material you gave, as a page for the agent to read first. HTML Studio does not read it back.

## Checks

Check renders every slide headless and reports:

| Rule | What it flags |
|---|---|
| `overflow` | content extending past the 1280 x 720 stage |
| `clipped` | text cut off by an ancestor with hidden overflow |
| `overlap` | two content elements covering each other (inline SVG counts as one picture) |
| `broken-image` | an `<img>` that did not load |
| `contrast` | text with contrast ratio under 4.5 (3 for large text) |
| `punctuation` | em or en dashes, middle dots, bullet characters in slide text (labels above headings are fine) |
| `external-resource` | a stylesheet, script, image or font fetched from the network |
| `inline-font-size` | `style="font-size: …"` on an element |
| `missing-cover` | the first slide is not marked as a cover |

Disable a rule for a deck with `check.disable` in `studio.json`.

## What HTML Studio never does

- It does not modify slide HTML except when you save in the code view, insert a layout, or reorder files.
- It does not write into the built output; edit the sources and rebuild.
- It does not run a deck's build command without your one-time approval.
- It does not touch files outside the deck folder, apart from its own settings in the app data directory.
