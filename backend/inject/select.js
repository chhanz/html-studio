// Select-to-edit overlay for HTML Studio's slide preview.
//
// Injected by the preview server into /slide/<n> when the page is requested
// with ?hs=select (see preview.py). It never talks to the backend: everything
// goes to the parent window over postMessage, and the parent owns all state.
//
//   overlay -> parent  { type: 'hs-capture', ...Capture }     user clicked an element
//   overlay -> parent  { type: 'hs-anchored', pins: [{id, how}] }  where pins landed
//   parent  -> overlay { type: 'hs-pins', pins: Pin[] }        draw / re-anchor pins
//
// Capture = { slideIndex, cid, selector, tag, elementId, classes, text, rect, src }
//   rect is in stage coordinates (1280x720), so it survives any scaling.
// Pin = { id, index, status, cid, selector, rect }
//   Re-anchoring order: data-studio-cid -> selector -> point (rect centre) -> lost.
(function () {
  'use strict'
  var STAGE = document.querySelector('.hs-stage') || document.body
  var SLIDE = STAGE.querySelector('.slide') || STAGE
  var slideIndex = (function () {
    var m = /\/slide\/(\d+)/.exec(location.pathname)
    return m ? parseInt(m[1], 10) : 0
  })()

  // --- chrome -------------------------------------------------------------
  var style = document.createElement('style')
  style.textContent = [
    '.hs-sel-box{position:absolute;pointer-events:none;border:2px solid #6d5efc;background:rgba(109,94,252,.08);box-sizing:border-box;z-index:2147483000}',
    '.hs-sel-label{position:absolute;pointer-events:none;background:#6d5efc;color:#fff;font:11px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:1px 6px;border-radius:4px;white-space:nowrap;z-index:2147483001}',
    '.hs-pin{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:#6d5efc;color:#fff;font:700 12px/22px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.35);z-index:2147483002;cursor:default;pointer-events:none}',
    '.hs-pin[data-status="sent"]{background:#d97706}',
    '.hs-pin[data-status="done"]{background:#16a34a}',
    '.hs-pin[data-status="question"]{background:#dc2626}',
    '.hs-pin[data-how="point"],.hs-pin[data-how="lost"]{outline:2px dashed rgba(255,255,255,.9)}',
    '.hs-sel-active, .hs-sel-active *{cursor:crosshair !important}',
  ].join('\n')
  document.head.appendChild(style)
  var box = document.createElement('div')
  box.className = 'hs-sel-box'
  box.style.display = 'none'
  var label = document.createElement('div')
  label.className = 'hs-sel-label'
  label.style.display = 'none'
  STAGE.appendChild(box)
  STAGE.appendChild(label)
  var pinLayer = document.createElement('div')
  pinLayer.className = 'hs-pin-layer'
  STAGE.appendChild(pinLayer)
  document.documentElement.classList.add('hs-sel-active')

  function isChrome(el) {
    return !el || el === STAGE || el === document.body || el === document.documentElement ||
      el.classList.contains('hs-sel-box') || el.classList.contains('hs-sel-label') ||
      el.classList.contains('hs-pin') || el.classList.contains('hs-pin-layer')
  }
  function target(el) {
    // Snap to something meaningful: skip bare inline wrappers with no text of their own.
    while (el && !isChrome(el) && el !== SLIDE) {
      var tag = el.tagName.toLowerCase()
      if (tag === 'span' || tag === 'b' || tag === 'i' || tag === 'em' || tag === 'strong' || tag === 'a') {
        var parent = el.parentElement
        if (parent && parent !== SLIDE && !isChrome(parent) && (parent.textContent || '').trim() === (el.textContent || '').trim()) {
          el = parent
          continue
        }
      }
      return el
    }
    return null
  }
  function stageRect(el) {
    var r = el.getBoundingClientRect()
    var s = STAGE.getBoundingClientRect()
    return { x: Math.round(r.left - s.left), y: Math.round(r.top - s.top), w: Math.round(r.width), h: Math.round(r.height) }
  }
  function selectorFor(el) {
    var parts = []
    var node = el
    while (node && node !== SLIDE && node !== STAGE && node.nodeType === 1) {
      var tag = node.tagName.toLowerCase()
      if (node.id) {
        parts.unshift('#' + CSS.escape(node.id))
        break
      }
      var i = 1
      var sib = node
      while ((sib = sib.previousElementSibling)) if (sib.tagName === node.tagName) i++
      parts.unshift(tag + ':nth-of-type(' + i + ')')
      node = node.parentElement
    }
    return parts.join(' > ')
  }
  function describe(el) {
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim()
    return {
      type: 'hs-capture',
      slideIndex: slideIndex,
      cid: el.getAttribute('data-studio-cid') || null,
      selector: selectorFor(el),
      tag: el.tagName.toLowerCase(),
      elementId: el.id || null,
      classes: Array.prototype.slice.call(el.classList).filter(function (c) { return c !== 'active' }),
      text: text.length > 120 ? text.slice(0, 117) + '...' : text,
      rect: stageRect(el),
      src: el.tagName === 'IMG' ? (el.getAttribute('src') || null) : null,
    }
  }
  function show(el) {
    if (!el) {
      box.style.display = 'none'
      label.style.display = 'none'
      return
    }
    var r = stageRect(el)
    box.style.display = 'block'
    box.style.left = r.x + 'px'
    box.style.top = r.y + 'px'
    box.style.width = r.w + 'px'
    box.style.height = r.h + 'px'
    label.style.display = 'block'
    label.textContent = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).filter(function (c) { return c !== 'active' }).join('.') : '')
    label.style.left = r.x + 'px'
    label.style.top = Math.max(0, r.y - 18) + 'px'
  }

  var hovered = null
  document.addEventListener('mousemove', function (e) {
    var el = target(document.elementFromPoint(e.clientX, e.clientY))
    if (el !== hovered) {
      hovered = el
      show(el)
    }
  }, true)
  document.addEventListener('mouseleave', function () { hovered = null; show(null) }, true)
  document.addEventListener('click', function (e) {
    e.preventDefault()
    e.stopPropagation()
    var el = target(document.elementFromPoint(e.clientX, e.clientY))
    if (!el) return
    parent.postMessage(describe(el), '*')
  }, true)
  // Nothing inside the slide should react to the click (links, buttons).
  ;['mousedown', 'mouseup', 'dblclick', 'contextmenu'].forEach(function (type) {
    document.addEventListener(type, function (e) { e.preventDefault(); e.stopPropagation() }, true)
  })

  // --- pins -----------------------------------------------------------------
  function anchor(pin) {
    var el = null
    var how = 'lost'
    if (pin.cid) {
      el = SLIDE.querySelector('[data-studio-cid="' + String(pin.cid).replace(/"/g, '\\"') + '"]')
      if (el) how = 'cid'
    }
    if (!el && pin.selector) {
      try { el = SLIDE.querySelector(pin.selector) } catch (_e) { el = null }
      if (el) how = 'selector'
    }
    if (!el && pin.rect) {
      var s = STAGE.getBoundingClientRect()
      var cand = target(document.elementFromPoint(s.left + pin.rect.x + pin.rect.w / 2, s.top + pin.rect.y + pin.rect.h / 2))
      if (cand && cand !== SLIDE) {
        el = cand
        how = 'point'
      }
    }
    var r = el ? stageRect(el) : pin.rect || { x: 20, y: 20, w: 0, h: 0 }
    return { el: el, how: how, rect: r }
  }
  function drawPins(pins) {
    pinLayer.innerHTML = ''
    var report = []
    pins.forEach(function (pin) {
      var a = anchor(pin)
      var dot = document.createElement('div')
      dot.className = 'hs-pin'
      dot.textContent = String(pin.index)
      dot.setAttribute('data-status', pin.status || 'new')
      dot.setAttribute('data-how', a.how)
      dot.setAttribute('data-pin', pin.id)
      dot.title = pin.comment || ''
      dot.style.left = (a.rect.x + a.rect.w) + 'px'
      dot.style.top = a.rect.y + 'px'
      pinLayer.appendChild(dot)
      report.push({ id: pin.id, how: a.how, rect: a.rect })
    })
    parent.postMessage({ type: 'hs-anchored', slideIndex: slideIndex, pins: report }, '*')
  }
  addEventListener('message', function (e) {
    var m = e.data || {}
    if (m.type === 'hs-pins' && Array.isArray(m.pins)) drawPins(m.pins)
  })
  parent.postMessage({ type: 'hs-select-ready', slideIndex: slideIndex }, '*')
})()
