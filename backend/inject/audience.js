// Audience window bridge for HTML Studio's presenter view.
//
// Injected by the preview server into the built deck when it is opened with
// ?hs=audience (the "Audience window" button opens that URL in the system
// browser). The presenter view runs inside the dashboard, a different browser
// process, so the two sides meet at the preview server: both poll and post
// /present/state on the same loopback origin.
//
//   GET  /present/state -> { seq, index, black, laser:{on,x,y}, presenter, audience }
//   POST /present/state <- { from:'audience', index? }   (heartbeat + own navigation)
//
// This script drives the deck's own runtime through the URL hash (every runtime
// we know follows #N), paints the laser dot and the blackout, and adds two keys
// for the projector machine: F = fullscreen.
(function () {
  'use strict'
  var STAGE_W = 1280, STAGE_H = 720
  var STATE = '/present/state'

  function currentIndex() {
    var n = parseInt(location.hash.slice(1), 10)
    return isNaN(n) ? 0 : Math.max(0, n - 1)
  }
  function goto(index) {
    var want = '#' + (index + 1)
    if (location.hash !== want) location.hash = want
  }
  function post(obj) {
    obj.from = 'audience'
    return fetch(STATE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) })
      .then(function (r) { return r.json() })
      .catch(function () { return null })
  }

  // --- laser + blackout overlay ---------------------------------------------
  var layer = document.createElement('div')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000'
  var dot = document.createElement('div')
  dot.id = 'hs-laser'
  dot.style.cssText = 'position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(255,40,40,.95);box-shadow:0 0 12px 4px rgba(255,40,40,.55);display:none'
  var black = document.createElement('div')
  black.id = 'hs-black'
  black.style.cssText = 'position:absolute;inset:0;background:#000;display:none'
  layer.appendChild(black)
  layer.appendChild(dot)
  document.body.appendChild(layer)

  function stageBox() {
    var el = document.querySelector('.stage, .hs-stage, .presentation .slide.active, .slide.active')
    if (el) {
      var r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) return r
    }
    var w = window.innerWidth, h = window.innerHeight
    var s = Math.min(w / STAGE_W, h / STAGE_H)
    return { left: (w - STAGE_W * s) / 2, top: (h - STAGE_H * s) / 2, width: STAGE_W * s, height: STAGE_H * s }
  }
  // Laser: the target moves in jumps (one message per pointer event); the dot
  // eases toward it every frame, which reads as a smooth pointer.
  var target = { on: false, x: 0, y: 0 }, cur = { x: 0, y: 0 }, animating = false
  function laser(l) {
    target = { on: !!(l && l.on), x: l ? +l.x || 0 : 0, y: l ? +l.y || 0 : 0 }
    if (!target.on) {
      dot.style.display = 'none'
      return
    }
    if (dot.style.display !== 'block') {
      cur = { x: target.x, y: target.y }
      dot.style.display = 'block'
    }
    if (!animating) {
      animating = true
      requestAnimationFrame(step)
    }
  }
  function step() {
    if (!target.on) {
      animating = false
      return
    }
    cur.x += (target.x - cur.x) * 0.45
    cur.y += (target.y - cur.y) * 0.45
    var b = stageBox()
    dot.style.left = b.left + (cur.x / STAGE_W) * b.width + 'px'
    dot.style.top = b.top + (cur.y / STAGE_H) * b.height + 'px'
    if (Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) < 0.3) {
      animating = false
      return
    }
    requestAnimationFrame(step)
  }

  // --- follow the presenter --------------------------------------------------
  // Fast path: a presenter window on the same browser talks over BroadcastChannel
  // (no latency, needed for the laser). Fallback: the shared state on the preview
  // server, for a presenter in another browser process (the dashboard).
  var applied = -1 // last seq applied
  var lastOwn = currentIndex()
  var channelAt = 0
  function setBlack(on) { black.style.display = on ? 'block' : 'none' }
  function apply(st) {
    if (!st) return
    if (st.seq !== applied) {
      applied = st.seq
      if (typeof st.index === 'number' && st.index !== currentIndex()) {
        lastOwn = st.index
        goto(st.index)
      }
      setBlack(!!st.black)
    }
    if (Date.now() - channelAt > 1500) laser(st.laser) // channel owns the laser while it is alive
  }
  var channel = new BroadcastChannel('hs-present-' + location.port)
  channel.onmessage = function (e) {
    var m = e.data || {}
    if (m.from !== 'presenter') return
    channelAt = Date.now()
    if (m.type === 'goto' && typeof m.index === 'number') { lastOwn = m.index; goto(m.index) }
    else if (m.type === 'laser') laser(m)
    else if (m.type === 'black') setBlack(!!m.on)
    else if (m.type === 'ping') channel.postMessage({ from: 'audience', type: 'pong', index: currentIndex() })
  }
  channel.postMessage({ from: 'audience', type: 'hello', index: currentIndex() })
  function poll() {
    fetch(STATE).then(function (r) { return r.json() }).then(apply).catch(function () {})
  }
  setInterval(poll, 250)
  poll()

  // Own navigation (clicker on this machine): runtimes tend to change the hash
  // with replaceState, which fires no hashchange, so watch the hash.
  function report() {
    var i = currentIndex()
    if (i === lastOwn) return
    lastOwn = i
    channel.postMessage({ from: 'audience', type: 'slide', index: i })
    post({ index: i }).then(apply)
  }
  addEventListener('hashchange', report)
  setInterval(report, 150)
  setInterval(function () { post({}) }, 2000) // heartbeat for the presence indicator
  post({ index: currentIndex() })

  // Projector-side key: F toggles fullscreen (the deck's own runtime may do the same; harmless twice).
  addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen && document.exitFullscreen()
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {})
    }
  }, true)
  addEventListener('beforeunload', function () { channel.postMessage({ from: 'audience', type: 'bye' }) })
})()
