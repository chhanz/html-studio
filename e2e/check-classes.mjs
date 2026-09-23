// Fails when the built UI uses a utility class the dashboard does not ship.
// The dashboard's Tailwind sheet is precompiled, so an unknown class renders
// as nothing (this is how an invisible status dot shipped once).
//
// host-classes.txt is the list of class names extracted from that sheet.
// Refresh it when the dashboard updates; keep it sorted.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = readFileSync(join(here, '..', 'ui', 'dist', 'index.mjs'), 'utf8')
const allow = new Set(readFileSync(join(here, 'host-classes.txt'), 'utf8').split('\n').filter(Boolean))

// Classes we generate ourselves (own <style> blocks) or that are safe no-ops.
const ownPrefixes = ['hs-']
const ownExact = new Set(['contents'])

const tokens = new Set()
for (const m of bundle.matchAll(/className:\s*(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)/g)) {
  for (const t of (m[1] ?? m[2] ?? m[3]).split(/\s+/)) if (t) tokens.add(t)
}
// Template-literal classNames like `inline-block w-2 h-2 rounded-full ${cls}`
// still contribute their literal words; dynamic parts are checked by name below.
for (const m of bundle.matchAll(/className:\s*`([^`]*)`/g)) {
  for (const t of m[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) if (t) tokens.add(t)
}
// Dynamic status classes are chosen from a fixed set: check those explicitly.
for (const t of ['bg-ok', 'bg-warn', 'bg-danger']) tokens.add(t)

// Classes chosen in ternaries or variables (`const cls = ok ? 'bg-ok' : 'bg-danger'`)
// never appear next to `className:`. Treat any quoted literal that looks like a
// Tailwind utility (prefix-word, e.g. bg-x, text-x, border-x, w-x) as a class.
const UTILITY = /^(bg|text|border|w|h|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|rounded|flex|grid|min|max|overflow|opacity|font|tracking|leading|shadow|ring|outline|hover:[a-z]+|focus:[a-z]+)-[a-z0-9[\]()/.%_-]+$/i
for (const m of bundle.matchAll(/["']([a-z0-9[\]()/.%:_ -]{2,120})["'](?<after>\s*:)?/gi)) {
  if (m.groups?.after) continue // an object key such as "check.rule.inline-font-size":
  // i18n message values (`"check.rule.x": "Inline font-size"`) are prose, not classes.
  const before = bundle.slice(Math.max(0, m.index - 80), m.index)
  if (/"[a-z0-9_.-]+\.[a-z0-9_.-]+":\s*$/i.test(before)) continue
  for (const t of m[1].split(/\s+/)) if (t && UTILITY.test(t)) tokens.add(t)
}

const missing = [...tokens].filter(
  (t) => !allow.has(t) && !ownPrefixes.some((p) => t.startsWith(p)) && !ownExact.has(t) && !/^[\d.]+$/.test(t),
)
if (missing.length) {
  console.error('Unknown host classes used by ui/dist/index.mjs:\n  ' + missing.sort().join('\n  '))
  process.exit(1)
}
console.log(`check-classes: ${tokens.size} classes, all present in host sheet`)
