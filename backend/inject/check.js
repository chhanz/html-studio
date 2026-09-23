// Deck check: rendered rules, run by the /check document of the preview server
// inside headless Chromium (one launch per deck). Each slide is loaded in a
// same-origin iframe at stage size and measured; the result is written into
// <script id="hs-check-output" type="application/json"> and the title becomes
// "hs-check-done", which the backend reads back from --dump-dom.
//
// Rules produced here (id -> what it means):
//   overflow          element extends beyond the 1280x720 stage
//   clipped           element cuts its own content (overflow hidden, scroll > client)
//   overlap           two content elements (text / image) intersect
//   broken-image      <img> did not load
//   contrast          text colour vs background below WCAG AA
//   punctuation       em/en dash, middle dot or bullet character in text
//   inline-font-size  font-size set in a style attribute
//   external-resource src/href/url() that points at http(s)://
(function () {
  'use strict'
  var cfg = window.HS_CHECK || { count: 0, base: '', stage: { width: 1280, height: 720 } }
  var STAGE_W = cfg.stage.width
  var STAGE_H = cfg.stage.height
  var results = []
  var BATCH = 6

  function selectorFor(el, root) {
    var parts = []
    var node = el
    while (node && node !== root && node.nodeType === 1) {
      if (node.id) {
        parts.unshift('#' + node.id)
        break
      }
      var i = 1
      var sib = node
      while ((sib = sib.previousElementSibling)) if (sib.tagName === node.tagName) i++
      parts.unshift(node.tagName.toLowerCase() + ':nth-of-type(' + i + ')')
      node = node.parentElement
    }
    return parts.join(' > ')
  }
  function snippet(el) {
    var t = (el.textContent || '').replace(/\s+/g, ' ').trim()
    return t.length > 80 ? t.slice(0, 77) + '...' : t
  }
  function classes(el) {
    return Array.prototype.slice.call(el.classList).filter(function (c) { return c !== 'active' })
  }
  function hasOwnText(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) return true
    return false
  }
  function parseColor(s) {
    var m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/.exec(s || '')
    if (!m) return null
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] }
  }
  function lum(c) {
    function ch(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b)
  }
  function ratio(a, b) {
    var l1 = lum(a), l2 = lum(b)
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  }
  function effectiveBg(el, win) {
    // Walk up until an opaque background colour; give up on images/gradients.
    var node = el
    while (node && node.nodeType === 1) {
      var cs = win.getComputedStyle(node)
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null
      var c = parseColor(cs.backgroundColor)
      if (c && c.a >= 0.99) return c
      node = node.parentElement
    }
    return { r: 255, g: 255, b: 255, a: 1 }
  }
  function rectOf(el, stage) {
    var r = el.getBoundingClientRect()
    var s = stage.getBoundingClientRect()
    return { x: Math.round(r.left - s.left), y: Math.round(r.top - s.top), w: Math.round(r.width), h: Math.round(r.height) }
  }
  function intersect(a, b) {
    var x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
    var y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
    return x * y
  }

  function measure(index, doc, win) {
    var stage = doc.querySelector('.hs-stage') || doc.body
    var slide = stage.querySelector('.slide') || stage
    var issues = []
    function push(rule, el, detail, extra) {
      var it = { rule: rule, slideIndex: index, selector: selectorFor(el, slide), tag: el.tagName.toLowerCase(), classes: classes(el), text: snippet(el), rect: rectOf(el, stage), detail: detail }
      if (extra) for (var k in extra) it[k] = extra[k]
      issues.push(it)
    }
    var all = Array.prototype.slice.call(slide.querySelectorAll('*')).filter(function (el) {
      var tag = el.tagName
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'META' || tag === 'BR') return false
      var cs = win.getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') return false
      var r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    })

    // overflow: outermost elements leaving the stage
    var overflowing = []
    all.forEach(function (el) {
      var r = rectOf(el, stage)
      var dx = Math.max(0, -r.x, r.x + r.w - STAGE_W)
      var dy = Math.max(0, -r.y, r.y + r.h - STAGE_H)
      if (dx > 2 || dy > 2) overflowing.push({ el: el, dx: dx, dy: dy })
    })
    overflowing.forEach(function (o) {
      var outerAlso = overflowing.some(function (p) { return p.el !== o.el && p.el.contains(o.el) })
      if (outerAlso) return
      var parts = []
      if (o.dy > 2) parts.push(Math.round(o.dy) + 'px vertically')
      if (o.dx > 2) parts.push(Math.round(o.dx) + 'px horizontally')
      push('overflow', o.el, 'extends beyond the stage by ' + parts.join(' and '))
    })

    // clipped: containers (not the slide itself) hiding part of their content
    all.forEach(function (el) {
      if (el === slide) return
      var cs = win.getComputedStyle(el)
      if (!/hidden|clip|auto|scroll/.test(cs.overflowY + cs.overflowX)) return
      var dy = el.scrollHeight - el.clientHeight
      var dx = el.scrollWidth - el.clientWidth
      if (dy > 3 || dx > 3) push('clipped', el, 'content cut by ' + (dy > 3 ? dy + 'px vertically' : dx + 'px horizontally'))
    })

    // broken images
    Array.prototype.forEach.call(slide.querySelectorAll('img'), function (img) {
      if (img.complete && img.naturalWidth === 0) push('broken-image', img, 'image did not load: ' + (img.getAttribute('src') || ''), { src: img.getAttribute('src') })
    })

    // content elements for overlap / contrast / text rules
    var content = all.filter(function (el) {
      return hasOwnText(el) || el.tagName === 'IMG' || el.tagName === 'SVG' || el.tagName === 'svg' || el.tagName === 'VIDEO'
    })

    // overlap: pairs of content elements neither containing the other. Inline
    // text runs (b, span, a ...) share a line box and wrap; their bounding
    // boxes "overlap" without anything being hidden, so pairs of inline
    // elements are ignored.
    function isInline(el) { return /^inline/.test(win.getComputedStyle(el).display) && el.tagName !== 'IMG' && el.tagName !== 'SVG' && el.tagName !== 'svg' }
    for (var i = 0; i < content.length; i++) {
      for (var j = i + 1; j < content.length; j++) {
        var a = content[i], b = content[j]
        if (a.contains(b) || b.contains(a)) continue
        if (isInline(a) && isInline(b)) continue
        if ((isInline(a) && a.parentElement && a.parentElement.contains(b)) || (isInline(b) && b.parentElement && b.parentElement.contains(a))) continue
        var ra = rectOf(a, stage), rb = rectOf(b, stage)
        var inter = intersect(ra, rb)
        if (!inter) continue
        var smaller = Math.min(ra.w * ra.h, rb.w * rb.h)
        if (smaller > 0 && inter / smaller > 0.2) {
          push('overlap', a, 'overlaps ' + b.tagName.toLowerCase() + (b.className && typeof b.className === 'string' ? '.' + classes(b).join('.') : '') + ' ("' + snippet(b) + '")', { otherSelector: selectorFor(b, slide) })
        }
      }
    }

    // contrast (AA: 4.5, or 3 for large text)
    content.forEach(function (el) {
      if (!hasOwnText(el)) return
      var cs = win.getComputedStyle(el)
      var fg = parseColor(cs.color)
      var bg = effectiveBg(el, win)
      if (!fg || !bg) return
      var size = parseFloat(cs.fontSize) || 16
      var bold = parseInt(cs.fontWeight, 10) >= 700
      var need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5
      var r = ratio(fg, bg)
      if (r < need) push('contrast', el, 'contrast ' + r.toFixed(2) + ':1 (text ' + cs.color + ' on rgb(' + bg.r + ', ' + bg.g + ', ' + bg.b + ')), needs ' + need + ':1')
    })

    // text rules
    content.forEach(function (el) {
      if (!hasOwnText(el)) return
      var own = ''
      for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3) own += n.nodeValue
      var found = []
      if (/[\u2014]/.test(own)) found.push('em dash')
      if (/[\u2013]/.test(own)) found.push('en dash')
      if (/[\u00b7\u2027\u30fb]/.test(own)) found.push('middle dot')
      if (/[\u2022]/.test(own)) found.push('bullet character')
      if (found.length) push('punctuation', el, 'contains ' + found.join(', '))
    })

    // inline font-size
    Array.prototype.forEach.call(slide.querySelectorAll('[style]'), function (el) {
      if (/font-size\s*:/.test(el.getAttribute('style') || '')) push('inline-font-size', el, 'font-size in a style attribute')
    })

    // external resources
    Array.prototype.forEach.call(slide.querySelectorAll('[src],[href],[style]'), function (el) {
      var v = el.getAttribute('src') || (el.tagName === 'LINK' ? el.getAttribute('href') : '') || ''
      var st = el.getAttribute('style') || ''
      var m = /url\((['"]?)(https?:\/\/[^'")]+)\1\)/.exec(st)
      if (/^https?:\/\//i.test(v)) push('external-resource', el, 'loads ' + v)
      else if (m) push('external-resource', el, 'loads ' + m[2])
    })

    return issues
  }

  function loadSlide(index) {
    return new Promise(function (resolve) {
      var f = document.createElement('iframe')
      f.width = STAGE_W
      f.height = STAGE_H
      f.style.cssText = 'position:absolute;left:0;top:0;width:' + STAGE_W + 'px;height:' + STAGE_H + 'px;border:0;visibility:hidden'
      f.onload = function () {
        var fin = function () {
          try {
            results.push.apply(results, measure(index, f.contentDocument, f.contentWindow))
          } catch (e) {
            results.push({ rule: 'check-error', slideIndex: index, selector: '', tag: '', classes: [], text: '', rect: null, detail: String(e && e.message || e) })
          }
          f.remove()
          resolve()
        }
        var d = f.contentDocument
        var ready = d && d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve()
        var imgs = Array.prototype.slice.call(d.images).filter(function (i) { return !i.complete })
        Promise.all([ready].concat(imgs.map(function (i) { return new Promise(function (r) { i.onload = i.onerror = r }) }))).then(function () { setTimeout(fin, 30) }, fin)
      }
      f.src = cfg.base + '/slide/' + index
      document.body.appendChild(f)
    })
  }

  var queue = []
  for (var i = 0; i < cfg.count; i++) queue.push(i)
  function next() {
    var batch = queue.splice(0, BATCH)
    if (!batch.length) return Promise.resolve()
    return Promise.all(batch.map(loadSlide)).then(next)
  }
  next().then(function () {
    var out = document.createElement('script')
    out.id = 'hs-check-output'
    out.type = 'application/json'
    out.textContent = JSON.stringify({ count: cfg.count, issues: results })
    document.body.appendChild(out)
    document.title = 'hs-check-done'
  })
})()
