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

## License

MIT
