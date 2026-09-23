/**
 * Minimal HTML syntax colouring for the code editor: no dependency, one pass,
 * good enough for slide markup. Tokens: comment, tag (angle brackets and the
 * tag name), attribute name, attribute value, entity, and CSS inside <style>
 * (property names and values). Everything else is plain text.
 *
 * Output is a list of [kind, text] pairs covering the input exactly, so the
 * highlighted layer and the textarea stay the same length and wrap identically.
 */
export type TokenKind = 'text' | 'comment' | 'tag' | 'attr' | 'value' | 'entity' | 'css-prop' | 'css-value' | 'punct'
export type Token = [TokenKind, string]

const TAG_OPEN = /^<\/?[A-Za-z][\w:-]*/
const ATTR = /^[^\s"'<>\/=]+/
const WS = /^\s+/

export function tokenizeHtml(src: string): Token[] {
  const out: Token[] = []
  let i = 0
  const push = (kind: TokenKind, text: string) => {
    if (!text) return
    const last = out[out.length - 1]
    if (last && last[0] === kind) last[1] += text
    else out.push([kind, text])
  }
  let inStyle = false
  while (i < src.length) {
    const rest = src.slice(i)
    if (rest.startsWith('<!--')) {
      const end = rest.indexOf('-->')
      const len = end < 0 ? rest.length : end + 3
      push('comment', rest.slice(0, len))
      i += len
      continue
    }
    if (inStyle && !/^<\/style/i.test(rest)) {
      // CSS until </style>: colour "prop:" and "value;" pairs, leave selectors plain.
      const end = rest.search(/<\/style/i)
      const css = end < 0 ? rest : rest.slice(0, end)
      tokenizeCss(css, push)
      i += css.length
      continue
    }
    const tag = TAG_OPEN.exec(rest)
    if (tag) {
      push('tag', tag[0])
      i += tag[0].length
      const name = tag[0].replace(/^<\/?/, '').toLowerCase()
      const closing = tag[0].startsWith('</')
      // attributes until '>'
      while (i < src.length) {
        const r = src.slice(i)
        const ws = WS.exec(r)
        if (ws) {
          push('text', ws[0])
          i += ws[0].length
          continue
        }
        if (r.startsWith('/>') || r.startsWith('>')) {
          const len = r.startsWith('/>') ? 2 : 1
          push('tag', r.slice(0, len))
          i += len
          break
        }
        if (r[0] === '=') {
          push('punct', '=')
          i += 1
          continue
        }
        if (r[0] === '"' || r[0] === "'") {
          const q = r[0]
          const end = r.indexOf(q, 1)
          const len = end < 0 ? r.length : end + 1
          push('value', r.slice(0, len))
          i += len
          continue
        }
        const a = ATTR.exec(r)
        if (a) {
          push('attr', a[0])
          i += a[0].length
          continue
        }
        push('text', r[0])
        i += 1
      }
      if (name === 'style') inStyle = !closing
      continue
    }
    if (rest[0] === '&') {
      const m = /^&[#\w]+;/.exec(rest)
      if (m) {
        push('entity', m[0])
        i += m[0].length
        continue
      }
    }
    // plain text up to the next interesting character
    const next = rest.slice(1).search(/[<&]/)
    const len = next < 0 ? rest.length : next + 1
    push('text', rest.slice(0, len))
    i += len
  }
  return out
}

function tokenizeCss(css: string, push: (k: TokenKind, t: string) => void): void {
  // Inside a declaration block: "name: value;" pairs. Outside: plain (selectors).
  let i = 0
  let inBlock = 0
  while (i < css.length) {
    const rest = css.slice(i)
    if (rest.startsWith('/*')) {
      const end = rest.indexOf('*/')
      const len = end < 0 ? rest.length : end + 2
      push('comment', rest.slice(0, len))
      i += len
      continue
    }
    if (rest[0] === '{') {
      inBlock++
      push('punct', '{')
      i++
      continue
    }
    if (rest[0] === '}') {
      inBlock = Math.max(0, inBlock - 1)
      push('punct', '}')
      i++
      continue
    }
    if (inBlock) {
      const decl = /^(\s*)([-\w]+)(\s*:\s*)([^;}]*)(;?)/.exec(rest)
      if (decl) {
        push('text', decl[1])
        push('css-prop', decl[2])
        push('punct', decl[3])
        push('css-value', decl[4])
        push('punct', decl[5])
        i += decl[0].length
        continue
      }
    }
    const next = rest.slice(1).search(/[{}]|\/\*/)
    const len = next < 0 ? rest.length : next + 1
    push('text', rest.slice(0, len))
    i += len
  }
}

/** Escape for insertion into the highlight layer's innerHTML. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
