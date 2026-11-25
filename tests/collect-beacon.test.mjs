// Run: node tests/collect-beacon.test.mjs : assets/collect.js in a stubbed browser (no dependencies)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SRC = readFileSync(new URL("../assets/collect.js", import.meta.url), "utf8");

function page({ url = "https://autonomy-ladder.io/assessment", referrer = "", storage, beacon = true, links = [], readyState = "complete" } = {}) {
  const u = new URL(url);
  const sent = [];
  const listeners = {};
  const store = storage === null ? null : storage || new Map();
  const anchors = links.map((href) => ({ nodeType: 1, tagName: "A", _href: href, getAttribute(k) { return k === "href" ? this._href : null; }, setAttribute(k, v) { if (k === "href") this._href = v; }, parentNode: null }));
  const document = {
    referrer, readyState,
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    querySelectorAll() { return anchors; },
    getElementById(id) { return document._els[id] || null; },
    _els: {},
  };
  const sessionStorage = store && { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  const window = {};
  const ctx = {
    window, document, location: { search: u.search, pathname: u.pathname },
    navigator: { userAgent: "Mozilla/5.0 (iPhone)", sendBeacon: beacon ? (ep, blob) => (sent.push({ ep, body: blob._t }), true) : undefined },
    Blob: class { constructor(parts) { this._t = parts.join(""); } },
    fetch: async (ep, init) => (sent.push({ ep, body: init.body, viaFetch: true }), {}),
    URL, URLSearchParams, JSON, Date, setTimeout: (fn) => fn(),
  };
  if (store) Object.defineProperty(window, "sessionStorage", { get: () => sessionStorage });
  else Object.defineProperty(window, "sessionStorage", { get: () => { throw new Error("SecurityError"); } });
  vm.runInNewContext(SRC, ctx);
  const fire = (type, target) => (listeners[type] || []).forEach((fn) => fn({ target }));
  return { get sent() { return sent.map((s) => ({ ...s, json: JSON.parse(s.body) })); }, raw: sent, window, store, anchors, fire, document };
}

// 1. Clean LinkedIn post link: visit event with exact payload; tags stored for the tab.
{
  const p = page({ url: "https://autonomy-ladder.io/assessment?utm_source=linkedin&utm_medium=social&utm_campaign=post-2026-11-25", referrer: "https://www.linkedin.com/feed/?trk=abc&email=a@b.co" });
  assert.equal(p.sent.length, 1);
  const e = p.sent[0].json;
  assert.equal(p.sent[0].ep, "https://kunjarbhaduri.com/api/collect");
  assert.deepEqual(Object.keys(e).sort(), ["device", "door", "event", "page", "referrer", "site", "ts", "utm_campaign", "utm_medium", "utm_source"].sort());
  assert.equal(e.site, "autonomy"); assert.equal(e.event, "al_visit"); assert.equal(e.page, "/assessment");
  assert.equal(e.utm_source, "linkedin"); assert.equal(e.utm_medium, "social"); assert.equal(e.utm_campaign, "post-2026-11-25");
  assert.equal(e.referrer, "https://www.linkedin.com"); // origin only: no path, no query
  assert.equal(e.device, "mobile");
  assert.equal(JSON.parse(p.store.get("al_utm")).utm_campaign, "post-2026-11-25");
}

// 2. Identifiers in tags never leave the page and are never stored.
{
  const p = page({ url: "https://autonomy-ladder.io/?utm_source=jane%40corp.com&utm_medium=4695550100&utm_campaign=post-2026-02-30", links: ["https://buy.stripe.com/abc"] });
  const e = p.sent[0].json;
  assert.equal(e.utm_source, ""); assert.equal(e.utm_medium, ""); assert.equal(e.utm_campaign, ""); assert.equal(e.door, "");
  assert.ok(!p.raw[0].body.includes("jane") && !p.raw[0].body.includes("4695550100"));
  assert.equal(p.store.has("al_utm"), false);
  assert.ok(!p.anchors[0]._href.includes("jane"));
}

// 3. Vocabulary mirror: accepted and rejected shapes.
{
  const { sanitize } = page().window.alCollectTest;
  assert.equal(sanitize("utm_source", "LinkedIn"), "linkedin");
  assert.equal(sanitize("utm_source", "linkedin.com"), "");
  assert.equal(sanitize("utm_campaign", "email-denton"), "email-denton");
  assert.equal(sanitize("utm_campaign", "email-denton-x"), "");
  assert.equal(sanitize("utm_campaign", "post-2026-13-01"), "");
  assert.equal(sanitize("utm_medium", "social"), "social");
  assert.equal(sanitize("utm_medium", undefined), "");
}

// 4. Cross-page carry-over: second page has no tags in the URL, uses the tab's stored clean tags;
//    a tampered stored value is re-sanitized.
{
  const store = new Map([["al_utm", JSON.stringify({ utm_source: "linkedin", utm_medium: "social", utm_campaign: "jane@corp.com" })]]);
  const p = page({ url: "https://autonomy-ladder.io/pricing", storage: store });
  const e = p.sent[0].json;
  assert.equal(e.utm_source, "linkedin"); assert.equal(e.utm_campaign, "");
}

// 5. Storage unavailable (private mode) and no sendBeacon: falls back to fetch, never throws.
{
  const p = page({ url: "https://autonomy-ladder.io/?utm_source=linkedin", storage: null, beacon: false });
  assert.equal(p.sent.length, 1); assert.equal(p.raw[0].viaFetch, true);
  assert.equal(p.sent[0].json.utm_source, "linkedin");
}

// 6. Stripe links are tagged at load (so open-in-new-tab carries tags); existing references kept.
{
  const p = page({ url: "https://autonomy-ladder.io/pricing?utm_source=linkedin&utm_campaign=post-2026-11-25",
    links: ["https://buy.stripe.com/abc", "https://buy.stripe.com/def?client_reference_id=partner_42", "https://example.com/x"] });
  assert.equal(p.anchors[0]._href, "https://buy.stripe.com/abc?client_reference_id=al_linkedin_post-2026-11-25&utm_source=linkedin&utm_campaign=post-2026-11-25");
  assert.match(p.anchors[1]._href, /client_reference_id=partner_42/);
  assert.ok(!/client_reference_id=al_/.test(p.anchors[1]._href));
  assert.equal(p.anchors[2]._href, "https://example.com/x");
  // Clicking twice does not duplicate parameters and records a checkout click.
  p.fire("click", p.anchors[0]); p.fire("click", p.anchors[0]);
  assert.equal((p.anchors[0]._href.match(/client_reference_id/g) || []).length, 1);
  assert.equal(p.sent.filter((s) => s.json.event === "al_checkout_click").length, 2);
}

// 7. No tags at all: Stripe link still gets a neutral reference, no empty utm params.
{
  const p = page({ links: ["https://buy.stripe.com/abc"] });
  assert.equal(p.anchors[0]._href, "https://buy.stripe.com/abc?client_reference_id=al");
}

// 8. Score reporting reads the rendered tier; form submit and data-event clicks are recorded.
{
  const p = page();
  p.document._els["cap-scored"] = { value: "A2 Delegated" };
  const btn = { nodeType: 1, id: "scoreBtn", tagName: "BUTTON", getAttribute: () => null, parentNode: null };
  p.fire("click", btn);
  p.fire("submit", { id: "capForm" });
  p.fire("click", { nodeType: 1, tagName: "A", getAttribute: (k) => (k === "data-event" ? "cta_pricing_hero" : null), parentNode: null });
  p.fire("click", { nodeType: 1, tagName: "A", getAttribute: (k) => (k === "data-event" ? "Bad Name!" : null), parentNode: null });
  const evs = p.sent.map((s) => s.json.event);
  assert.deepEqual(evs, ["al_visit", "al_score_a2", "al_capture_submit", "cta_pricing_hero"]);
}

// 9. Referrer shapes.
{
  const { cleanReferrer } = page().window.alCollectTest;
  assert.equal(cleanReferrer("https://autonomy-ladder.io/assessment?utm_source=x&email=a@b.co"), "https://autonomy-ladder.io");
  assert.equal(cleanReferrer("javascript:alert(1)"), "");
  assert.equal(cleanReferrer(""), "");
}
console.log("collect beacon: all tests passed");
