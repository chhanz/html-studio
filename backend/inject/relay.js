// Presenter relay: runs inside the presenter view's current-slide iframe
// (/slide/N?hs=relay). The studio page lives on the dashboard's origin while the
// audience window lives on the preview server's origin, and BroadcastChannel is
// per-origin, so this frame relays: parent postMessage <-> BroadcastChannel.
//
//   parent -> relay   { type: 'hs-relay', msg }   forwarded to the channel as-is
//   relay  -> parent  { type: 'hs-relay', msg }   every channel message from the audience
(function () {
  'use strict'
  var channel = new BroadcastChannel('hs-present-' + location.port)
  channel.onmessage = function (e) {
    var m = e.data || {}
    if (m.from === 'presenter') return
    parent.postMessage({ type: 'hs-relay', msg: m }, '*')
  }
  addEventListener('message', function (e) {
    var m = e.data || {}
    if (m.type === 'hs-relay' && m.msg) channel.postMessage(m.msg)
  })
  parent.postMessage({ type: 'hs-relay-ready' }, '*')
})()
