# Contributing

Thanks for looking at HTML Studio. This page covers how the project is put together and what a change should come with.

## Layout

```
backend/        Python 3.9 or newer, standard library only; one module per feature
backend/inject/ scripts and pages the preview server injects or serves (select overlay, check, presenter)
backend/layouts/ built-in slide layouts
backend/tests/  unittest suites (one file per module)
ui/             React + TypeScript (Vite); the dashboard supplies react, lucide-react and @kirocrew/app-sdk
ui/src/hooks/   one hook per concern (connection, preview, build, chat, pins, check, arrange, theme, layout)
ui/src/components/ the panes and dialogs; App.tsx wires the hooks to them and lays out the page
e2e/            Playwright harness that runs the built UI against the real backend
skills/         the skill the agent reads before applying visual-edit batches
docs/           user-facing documentation
```

## Running it

```bash
cd ui && npm install && npm run build
cd ../e2e && npm install && npx playwright install chromium
cd .. && ./verify.sh
```

`./verify.sh quick` skips the end-to-end suite. Everything in `verify.sh` must pass before a change is merged.

## Conventions

- **No dependencies in the backend.** The server is standard-library Python so it starts anywhere the dashboard runs. If a feature needs a browser (Check, PDF), it uses the user's installed Chromium-based browser headless.
- **The UI cannot add Tailwind classes.** The dashboard ships a precompiled stylesheet; `e2e/check-classes.mjs` lists what exists. Use CSS variables (`var(--accent)` and friends) and inline styles for anything else.
- **Copy has no em or en dashes.** `e2e/check-strings.mjs` enforces it in UI strings. Use a comma, a colon or a full stop.
- **Buttons, not shortcuts.** The dashboard shell owns many key combinations, so every action must be reachable by a visible control. Keys are only added where they are known to reach the app (arrow keys in the show, Tab in the code editor).
- **Files in a deck are the user's.** Write only what the user asked for, in the file they expect, and never delete: archive instead.
- **Sample content is fictional.** Fixtures, screenshots and tests use the made-up "Acme" material in `e2e/fixtures`. Do not add real company, customer or personal data.
- **State is applied by value.** When two windows share state (the show and the presenter window), apply what the server says, not a sequence number; write paths pause reads while a write is in flight.

## Tests

- A backend change comes with a `unittest` case in `backend/tests/`.
- A UI change that a user can see comes with an end-to-end step in `e2e/tests/studio.spec.ts`. The harness has a fake dashboard chat API and `/__ctl/*` hooks to simulate the agent writing files; use them instead of mocking inside the UI.
- Prefer testing through the public surface (HTTP routes, rendered DOM) over internals.

## Releases

`main` holds sources only; `ui/dist` is ignored there. The Kiro Crew app catalog installs by plain git clone with no build step, so it points at a release branch commit, which is `main` plus the built UI. Each version gets its own branch, `release-v<version>` (for example `release-v0.1.35`), and a tag `v<version>` on the same commit. To cut one, bump `version` in `app.json` and `APP_VERSION` in `backend/server.py` together (`verify.sh` checks they match), then run `tools/release.sh` from a clean `main`: it builds the UI, creates `release-v<version>` from `main`, commits `ui/dist` there and tags it. Push `main`, the release branch and the tag. The older `release` branch holds v0.1.34 and is kept only because the first catalog entry pins its commit.

## Commits and pull requests

- One change per commit, English message: a short imperative first line, then why it was done and what a reader should know.
- A pull request describes what changed for the user, how it was verified, and anything left out on purpose.

## Licence of contributions

By contributing you agree that your contribution is licensed under the Apache License 2.0, the licence of this repository (see `LICENSE`). Third-party assets you add go into `ATTRIBUTION.md` with their own licence.

## Reporting issues

Please include the deck shape (split or single file, with or without `studio.json` and `DESIGN.md`), what you did, what you expected, and the backend version shown in the status line. A minimal deck that reproduces the problem is the most useful attachment.
