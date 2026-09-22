# HTML Studio

A [Kiro Crew](https://kiro.dev) app for viewing, editing, checking and presenting HTML slide decks.

- Browse decks (one HTML file per slide) and preview them live
- Point at an element in the preview, leave a comment, and let the agent apply the change
- Run deck checks (overflow, forbidden patterns, missing cover, contrast)
- Present from the current slide, with speaker notes and a laser pointer
- Export to PDF
- Themes follow the [DESIGN.md](https://github.com/VoltAgent/awesome-design-md) format

Status: early development. Korean documentation: `README.ko.md`.

## Development

```bash
cd ui && npm install && npm run build      # produces ui/dist/index.mjs
python3 -m unittest backend/tests/test_server.py
kirocrew app install /path/to/html-studio
kirocrew app enable html-studio
```

The dashboard provides `react`, `lucide-react` and `@kirocrew/app-sdk` at runtime; they are marked external in `ui/vite.config.ts`.

## Verification

```bash
./verify.sh quick   # backend tests, typecheck, build, host-class lint
./verify.sh         # ...plus the end-to-end harness (headless Chromium)
```

`e2e/` runs the built UI bundle against the real backend inside a harness that
stands in for the dashboard (SDK shim + signed proxy), using the fictional
sample decks in `e2e/fixtures/`. `e2e/check-classes.mjs` fails the build when
the UI uses a Tailwind class the dashboard's precompiled stylesheet does not
ship. First run: `cd e2e && npm install && npx playwright install chromium`.

## License

MIT
