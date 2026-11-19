// Run: node tests/leads-spam.test.mjs : contact-form spam screen
// functions/api/leads.js stores only (no LEAD_NOTIFY); the Worker copy is tested in leads-spam-worker.test.mjs
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/leads.js";

const kv = () => { const m = new Map(); const o = new Map(); return { m, o, async put(k, v, opt) { m.set(k, v); o.set(k, opt); } }; };
const good = { name: "Pat", email: "pat@example.com", interest: "self-score" };
const GEO = "მინდოდა ვიცოდე თქვენი ფასი";

async function run(body) {
  const LEADS = kv(); const sent = []; const waits = [];
  const env = { LEADS, ASSETS: { fetch: async () => new Response("asset") }, LEAD_NOTIFY: { fetch: async (u, i) => { sent.push(1); return new Response("{}"); } } };
  const res = await onRequestPost({ request: new Request("https://example.test/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), env, waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  return { status: res.status, keys: [...LEADS.m.keys()], opts: LEADS.o, sent: sent.length };
}

// honeypot filled: same success status, kept as spam: with 30-day TTL, owner not notified
{ const r = await run({ ...good, website: "http://x.example" });
  assert.equal(r.status, 303); assert.equal(r.sent, 0);
  assert.equal(r.keys.length, 1); assert.ok(r.keys[0].startsWith("spam:"));
  const o = r.opts.get(r.keys[0]); assert.equal(o.metadata.spam, 1); assert.equal(o.expirationTtl, 2592000); }

// submitted 0.5 s after page load: spam
{ const r = await run({ ...good, ts: Date.now() - 500 });
  assert.equal(r.status, 303); assert.equal(r.sent, 0); assert.ok(r.keys[0].startsWith("spam:")); }

// real visitor: slow submit, no JS timestamp, garbled timestamp, non-Latin notes alone
for (const extra of [{ ts: Date.now() - 60000 }, { ts: "" }, { ts: "garbage" }, { website: "" }, { notes: GEO }]) {
  const r = await run({ ...good, ...extra });
  assert.equal(r.status, 303); assert.ok(r.keys[0].startsWith("lead:"), JSON.stringify(extra)); }

// the 2026-11-18 bot pattern: CamelCase single-token name + Georgian-only notes (placeholder email)
{ const r = await run({ ...good, name: "RobertLot", email: "bot@example.com", notes: GEO });
  assert.equal(r.sent, 0); assert.ok(r.keys[0].startsWith("spam:")); }
// a real CamelCase surname alone is not flagged
{ const r = await run({ ...good, name: "McKenzie" }); assert.ok(r.keys[0].startsWith("lead:")); }
console.log("spam screen: all tests passed");
