// Audience window bridge for HTML Studio's presenter view.
//
// Injected by the preview server into the built deck when it is opened with
// ?hs=audience (the "Audience window" button opens that URL in the system
// browser). The presenter view inside the studio shows a slide of the same
// preview server, so both windows share an origin and a BroadcastChannel
// named after the deck port. Protocol (all messages carry `from`):
//
//   presenter -> audience  { type: 'goto', index }          show slide (0-based)
//   presenter -> audience  { type: 'laser', x, y, on }      pointer in stage coords (1280x720), on=false hides
//   presenter -> audience  { type: 'black', on }            blank the screen
//   presenter -> audience  { type: 'ping' }                 are you there?
//   audience  -> presenter { type: 'hello' | 'pong', index } presence (+ current slide)
//   audience  -> presenter { type: 'slide', index }          the deck moved on its own (keys in this window)
//
// Nothing here calls the backend; it only drives the deck's own runtime via the
// URL hash (every runtime we know follows #N) and paints an overlay canvas.
(function () {
  'use strict'
  var STAGE_W = 1280, STAGE_H = 720
  var channel = new BroadcastChannel('hs-present-' + location.port)
  var me = 'audience'

  function currentIndex() {
    var n = parseInt(location.hash.slice(1), 10)
    return isNaN(n) ? 0 : Math.max(0, n - 1)
  }
  function goto(index) {
    var want = '#' + (index + 1)
    lastIndex = index // set by the presenter: do not echo it back as our own move
    if (location.hash !== want) location.hash = want
  }
  var lastIndex = 0

  // --- laser + blackout overlay ---------------------------------------------
  var layer = document.createElement('div')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000'
  var dot = document.createElement('div')
  dot.style.cssText = 'position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(255,40,40,.95);box-shadow:0 0 12px 4px rgba(255,40,40,.55);display:none'
  var black = document.createElement('div')
  black.style.cssText = 'position:absolute;inset:0;background:#000;display:none'
  layer.appendChild(black)
  layer.appendChild(dot)
  document.body.appendChild(layer)

  // The deck scales its 1280x720 stage to the window; find the stage box to map
  // presenter coordinates. Fall back to a centred 16:9 box.
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
  function laser(x, y, on) {
    if (!on) {
      dot.style.display = 'none'
      return
    }
    var b = stageBox()
    dot.style.display = 'block'
    dot.style.left = b.left + (x / STAGE_W) * b.width + 'px'
    dot.style.top = b.top + (y / STAGE_H) * b.height + 'px'
  }

  channel.onmessage = function (e) {
    var m = e.data || {}
    if (m.from === me) return
    if (m.type === 'goto' && typeof m.index === 'number') goto(m.index)
    else if (m.type === 'laser') laser(m.x, m.y, m.on !== false)
    else if (m.type === 'black') black.style.display = m.on ? 'block' : 'none'
    else if (m.type === 'ping') channel.postMessage({ from: me, type: 'pong', index: currentIndex() })
  }
  // Runtimes tend to update the hash with history.replaceState, which fires no
  // hashchange; watch the hash instead so keys pressed in THIS window still
  // report the slide to the presenter.
  lastIndex = currentIndex()
  function report() {
    var i = currentIndex()
    if (i === lastIndex) return
    lastIndex = i
    channel.postMessage({ from: me, type: 'slide', index: i })
  }
  addEventListener('hashchange', report)
  setInterval(report, 150)
  addEventListener('beforeunload', function () {
    channel.postMessage({ from: me, type: 'bye' })
  })
  channel.postMessage({ from: me, type: 'hello', index: currentIndex() })
})()
