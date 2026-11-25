/* First-party, cookieless beacon to the shared collector (site id "autonomy").
   Sends event, path, referring origin, attribution tags and a coarse device
   class only. Tags are reduced IN THE BROWSER to the same finite vocabulary
   the collector enforces (kunjarbhaduri.com functions/api/collect.js, vocab()),
   so free text such as an email in a link never leaves the page, is never kept
   in sessionStorage and never reaches Stripe. The referrer is cut to its
   origin. Never throws; a failed send changes nothing.

   Events:
     al_visit            page load
     al_score_a0..a4     "See my tier" clicked on /assessment (tier shown)
     al_capture_submit   benchmark + brief form submitted (attempt, not a lead)
     al_checkout_click   a Stripe payment link clicked
     <data-event>        any element carrying a valid data-event name

   Clean tags are kept for this tab only (sessionStorage key al_utm), so a
   visitor who lands on /assessment and moves to /pricing keeps attribution.
   Stripe payment links on the page are tagged when the page loads (so
   open-in-new-tab and copy-link carry the tags too); an existing
   client_reference_id on a link is never overwritten. */
(function () {
  "use strict";
  var ENDPOINT = "https://kunjarbhaduri.com/api/collect";
  var NAME_RX = /^[a-z0-9_]{1,48}$/;
  var KEYS = ["utm_source", "utm_medium", "utm_campaign"];

  // Mirror of the collector vocabulary. Keep in sync with collect.js vocab().
  var SOURCES = ["readyestatesdfw", "sellasisdfw", "sellmydfwhouse", "dfwprobatebuyer", "dfwhomeowneroptions", "fpa-door", "fpa", "keptclose-door",
    "google", "bing", "linkedin", "facebook", "instagram", "pinterest", "nextdoor", "youtube", "x", "reddit", "github", "pypi", "newsletter",
    "chatgpt", "perplexity", "gbp", "email", "referral"];
  var MEDIUMS = ["door", "email", "social", "referral", "organic", "profile", "video", "newsletter", "community"];
  var CHANNELS = ["guide", "email", "gbp", "referral", "bigdog", "social", "card"];
  var COUNTIES = ["dallas", "tarrant", "collin", "denton", "rockwall", "kaufman", "ellis", "johnson", "parker", "dfw"];

  function validDate(y, m, d) {
    var t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  }

  // Returns the clean value, or "" when absent or not in the vocabulary.
  // Unlike the collector (which stores "other"), the browser drops unknown
  // values entirely so nothing unrecognized is transmitted.
  function sanitize(kind, value) {
    var v = typeof value === "string" ? value.trim().toLowerCase().slice(0, 64) : "";
    if (!v) return "";
    if (kind === "utm_source") return SOURCES.indexOf(v) >= 0 ? v : "";
    if (kind === "utm_medium") return MEDIUMS.indexOf(v) >= 0 ? v : "";
    if (kind === "utm_campaign") {
      var p = /^post-(\d{4})-(\d{2})-(\d{2})$/.exec(v);
      if (p) return validDate(+p[1], +p[2], +p[3]) ? v : "";
      var parts = v.split("-");
      return parts.length === 2 && CHANNELS.indexOf(parts[0]) >= 0 && COUNTIES.indexOf(parts[1]) >= 0 ? v : "";
    }
    return "";
  }

  function cleanReferrer(ref) {
    try {
      var u = new URL(ref);
      return u.protocol === "https:" || u.protocol === "http:" ? u.origin : "";
    } catch (e) {
      return "";
    }
  }

  function readTags(search, storage) {
    var q = new URLSearchParams(search || ""), out = {}, have = false, i, v;
    for (i = 0; i < KEYS.length; i++) {
      v = sanitize(KEYS[i], q.get(KEYS[i]));
      out[KEYS[i]] = v;
      if (v) have = true;
    }
    try {
      if (have) storage.setItem("al_utm", JSON.stringify(out));
      else {
        var saved = JSON.parse(storage.getItem("al_utm") || "null") || {};
        for (i = 0; i < KEYS.length; i++) out[KEYS[i]] = sanitize(KEYS[i], saved[KEYS[i]]);
      }
    } catch (e) {}
    return out;
  }

  // Adds attribution to a Stripe payment link. Returns the new href, or the
  // original when it is not a Stripe link or there is nothing to add.
  function tagHref(href, tags) {
    try {
      var u = new URL(href);
      if (u.protocol !== "https:" || u.hostname !== "buy.stripe.com") return href;
      var parts = ["al"];
      if (tags.utm_source) parts.push(tags.utm_source);
      if (tags.utm_campaign) parts.push(tags.utm_campaign);
      if (!u.searchParams.get("client_reference_id")) u.searchParams.set("client_reference_id", parts.join("_").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 200));
      for (var i = 0; i < KEYS.length; i++) if (tags[KEYS[i]] && !u.searchParams.get(KEYS[i])) u.searchParams.set(KEYS[i], tags[KEYS[i]]);
      return u.toString();
    } catch (e) {
      return href;
    }
  }

  var storage;
  try { storage = window.sessionStorage; } catch (e) { storage = null; }
  var U = readTags(location.search, storage || { getItem: function () { return null; }, setItem: function () {} });

  function send(name) {
    try {
      if (!NAME_RX.test(name)) return;
      var ua = navigator.userAgent || "";
      var body = JSON.stringify({
        site: "autonomy",
        event: name,
        page: location.pathname,
        referrer: cleanReferrer(document.referrer || ""),
        utm_source: U.utm_source,
        utm_medium: U.utm_medium,
        utm_campaign: U.utm_campaign,
        door: U.utm_source,
        device: /iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop",
        ts: Date.now()
      });
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain" }))) return;
      if (typeof fetch === "function") fetch(ENDPOINT, { method: "POST", body: body, headers: { "Content-Type": "text/plain" }, keepalive: true, mode: "cors" }).catch(function () {});
    } catch (e) {}
  }
  window.alCollect = send;
  window.alCollectTest = { sanitize: sanitize, cleanReferrer: cleanReferrer, tagHref: tagHref, readTags: readTags, tags: U };

  function closest(node, test) {
    while (node && node !== document) {
      if (node.nodeType === 1 && test(node)) return node;
      node = node.parentNode;
    }
    return null;
  }
  function isStripe(n) { return n.tagName === "A" && /^https:\/\/buy\.stripe\.com\//.test(n.getAttribute("href") || ""); }
  function tagAll() {
    try {
      var links = document.querySelectorAll('a[href^="https://buy.stripe.com/"]');
      for (var i = 0; i < links.length; i++) links[i].setAttribute("href", tagHref(links[i].getAttribute("href"), U));
    } catch (e) {}
  }

  document.addEventListener(
    "click",
    function (ev) {
      var t = ev.target;
      var stripe = closest(t, isStripe);
      if (stripe) {
        stripe.setAttribute("href", tagHref(stripe.getAttribute("href"), U));
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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tagAll);
  else tagAll();
  send("al_visit");
})();
