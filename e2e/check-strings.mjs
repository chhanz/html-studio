// UI copy rules: no em/en dashes in user-facing strings (i18n files and the
// deck brief). Fails loudly so the rule survives future edits.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const files = ['ui/src/i18n/en.json', 'ui/src/i18n/ko.json', 'ui/src/chat.ts']
const bad = []
for (const rel of files) {
  const lines = readFileSync(join(repo, rel), 'utf-8').split('\n')
  lines.forEach((line, i) => {
    if (rel.endsWith('.ts') && /^\s*(\/\/|\/\*|\*)/.test(line)) return // code comments are fine
    if (/[\u2013\u2014]/.test(line)) bad.push(`${rel}:${i + 1}: ${line.trim()}`)
  })
}
if (bad.length) {
  console.error('check-strings: em/en dash in UI copy:\n  ' + bad.join('\n  '))
  process.exit(1)
}
console.log(`check-strings: ${files.length} files, no em/en dashes in UI copy`)
