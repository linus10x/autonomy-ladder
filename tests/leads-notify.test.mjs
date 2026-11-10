// Run: node tests/leads-notify.test.mjs
import assert from "node:assert/strict";
import worker from "../workers/leads.js";

const kv = () => { const m = new Map(); return { m, async put(k, v) { m.set(k, v); } }; };
const req = (body) => new Request("https://autonomy-ladder.io/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const good = { name: "Pat", email: "pat@example.com" };

// find a valid interest from the source
const src = (await import("node:fs")).readFileSync(new URL("../workers/leads.js", import.meta.url), "utf8");
const interest = src.match(/INTERESTS = new Set\(\[\s*"([^"]+)"/)[1];

// stored then notified
{
  const sent = [], waits = [];
  const env = { LEADS: kv(), LEAD_NOTIFY: { fetch: async (u, init) => { sent.push(JSON.parse(init.body)); return new Response("{}"); } } };
  const res = await worker.fetch(req({ ...good, interest }), env, { waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  assert.equal(res.status, 200);
  assert.equal(env.LEADS.m.size, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].site, "autonomy-ladder.io");
  assert.equal(sent[0].fields.email, "pat@example.com");
}
// no binding: still stores and succeeds
{
  const env = { LEADS: kv() };
  const res = await worker.fetch(req({ ...good, interest }), env, {});
  assert.equal(res.status, 200);
  assert.equal(env.LEADS.m.size, 1);
}
// notifier failure never changes the response
{
  const waits = [];
  const env = { LEADS: kv(), LEAD_NOTIFY: { fetch: async () => { throw new Error("down"); } } };
  const res = await worker.fetch(req({ ...good, interest }), env, { waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  assert.equal(res.status, 200);
}
// invalid lead: no store, no notify
{
  const sent = [];
  const env = { LEADS: kv(), LEAD_NOTIFY: { fetch: async () => { sent.push(1); return new Response("{}"); } } };
  const res = await worker.fetch(req({ email: "bad", interest }), env, {});
  assert.equal(res.status, 400);
  assert.equal(sent.length, 0);
}
console.log("autonomy leads notify: all tests passed");
