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

## Commits and pull requests

- One change per commit, English message: a short imperative first line, then why it was done and what a reader should know.
- A pull request describes what changed for the user, how it was verified, and anything left out on purpose.

## Reporting issues

Please include the deck shape (split or single file, with or without `studio.json` and `DESIGN.md`), what you did, what you expected, and the backend version shown in the status line. A minimal deck that reproduces the problem is the most useful attachment.
