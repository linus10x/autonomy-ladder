/* First-party conversion events. In-memory only unless meta dfw-analytics=collect. */
(function () {
  "use strict";
  var queue = (window.alEvents = window.alEvents || []);
  function track(name, props) {
    if (!name) return;
    queue.push({ name: String(name), t: Date.now(), path: location.pathname, props: props || {} });
  }
  window.alTrack = track;
  document.addEventListener(
    "click",
    function (ev) {
      var node = ev.target;
      while (node && node !== document && !(node.getAttribute && node.getAttribute("data-event"))) {
        node = node.parentNode;
      }
      if (!node || node === document) return;
      track(node.getAttribute("data-event"), { href: node.getAttribute("href") || "" });
    },
    true
  );
})();
