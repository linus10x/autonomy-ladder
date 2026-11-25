/* First-party, cookieless beacon to the shared collector (site id "autonomy").
   Sends event, path, referrer, utm tags and a coarse device class only. The
   collector at kunjarbhaduri.com/api/collect minimizes everything again
   server-side and stores no IP. Never throws; a failed send changes nothing.

   Events:
     al_visit            page load
     al_score_a0..a4     "See my tier" clicked on /assessment (tier shown)
     al_capture_submit   benchmark + brief form submitted (attempt, not a lead)
     al_checkout_click   a Stripe payment link clicked
     <data-event>        any element carrying a valid data-event name

   UTM tags from the landing URL are kept for this tab in sessionStorage, so a
   visitor who lands on /assessment and moves to /pricing keeps attribution.
   They are also passed to Stripe payment links (client_reference_id + utm). */
(function () {
  "use strict";
  var ENDPOINT = "https://kunjarbhaduri.com/api/collect";
  var NAME_RX = /^[a-z0-9_]{1,48}$/;
  var KEYS = ["utm_source", "utm_medium", "utm_campaign"];

  function utm() {
    var q = new URLSearchParams(location.search), out = {}, have = false, i, k, v;
    for (i = 0; i < KEYS.length; i++) {
      k = KEYS[i];
      v = (q.get(k) || "").slice(0, 64);
      out[k] = v;
      if (v) have = true;
    }
    try {
      if (have) sessionStorage.setItem("al_utm", JSON.stringify(out));
      else out = JSON.parse(sessionStorage.getItem("al_utm") || "null") || out;
    } catch (e) {}
    return out;
  }
  var U = utm();

  function send(name) {
    try {
      if (!NAME_RX.test(name)) return;
      var ua = navigator.userAgent || "";
      var body = JSON.stringify({
        site: "autonomy",
        event: name,
        page: location.pathname,
        referrer: document.referrer || "",
        utm_source: U.utm_source || "",
        utm_medium: U.utm_medium || "",
        utm_campaign: U.utm_campaign || "",
        door: U.utm_source || "",
        device: /iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop",
        ts: Date.now()
      });
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain" }))) return;
      fetch(ENDPOINT, { method: "POST", body: body, headers: { "Content-Type": "text/plain" }, keepalive: true, mode: "cors" }).catch(function () {});
    } catch (e) {}
  }
  window.alCollect = send;

  function closest(node, test) {
    while (node && node !== document) {
      if (node.nodeType === 1 && test(node)) return node;
      node = node.parentNode;
    }
    return null;
  }

  function tagStripe(a) {
    try {
      if (a.getAttribute("data-al-tagged")) return;
      var u = new URL(a.href);
      if (u.hostname !== "buy.stripe.com") return;
      var ref = ["al", U.utm_source, U.utm_campaign].filter(Boolean).join("_").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 200);
      u.searchParams.set("client_reference_id", ref);
      for (var i = 0; i < KEYS.length; i++) if (U[KEYS[i]]) u.searchParams.set(KEYS[i], U[KEYS[i]]);
      a.href = u.toString();
      a.setAttribute("data-al-tagged", "1");
    } catch (e) {}
  }

  document.addEventListener(
    "click",
    function (ev) {
      var t = ev.target;
      var stripe = closest(t, function (n) { return n.tagName === "A" && /^https:\/\/buy\.stripe\.com\//.test(n.href || ""); });
      if (stripe) {
        tagStripe(stripe);
        send("al_checkout_click");
        return;
      }
      if (closest(t, function (n) { return n.id === "scoreBtn"; })) {
        // The page renders the tier synchronously in its own click handler;
        // read it on the next tick.
        setTimeout(function () {
          var f = document.getElementById("cap-scored") || document.getElementById("cap-tier");
          var m = /A([0-4])/.exec((f && f.value) || "");
          send(m ? "al_score_a" + m[1] : "al_score");
        }, 0);
        return;
      }
      var tagged = closest(t, function (n) { return n.getAttribute && n.getAttribute("data-event"); });
      if (tagged) send(tagged.getAttribute("data-event"));
    },
    true
  );

  document.addEventListener(
    "submit",
    function (ev) {
      if (ev.target && ev.target.id === "capForm") send("al_capture_submit");
    },
    true
  );

  send("al_visit");
})();
