// Tailwind v3 config for the E2E harness ONLY. Scans the built UI bundle and the
// shim so every class they use is emitted into shim/dist/harness.css; the
// harness page then needs no CDN and works fully offline.
export default {
  content: ['../ui/dist/index.mjs', './shim/app-sdk-ui.js', './harness.html'],
  theme: {
    extend: {
      colors: {
        accent: 'var(--accent)', muted: 'var(--muted)', border: 'var(--border)', 'border-strong': 'var(--border-strong)',
        card: 'var(--card)', bg: 'var(--bg)', 'bg-elevated': 'var(--bg-elevated)', 'bg-hover': 'var(--bg-hover)',
        text: 'var(--text)', 'text-strong': 'var(--text-strong)', ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)',
      },
    },
  },
  corePlugins: { preflight: true },
}
