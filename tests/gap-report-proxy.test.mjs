// Run: node tests/gap-report-proxy.test.mjs : Gap Report paths go to the private engine
import assert from "node:assert/strict";
import worker, { isEnginePath } from "../workers/leads.js";

for (const p of ["/api/gap-report", "/api/gap-report/", "/api/gap-report/form", "/api/gap-report/checkout", "/api/gap-report/preview", "/gap-report/view", "/api/stripe/webhook"]) assert.ok(isEnginePath(p), p);
for (const p of ["/gap-report", "/api/leads", "/", "/api/gap-reportx", "/gap-report/viewer"]) assert.ok(!isEnginePath(p), p);

const seen = [];
const env = {
  ASSETS: { fetch: async (r) => new Response("asset " + new URL(r.url).pathname) },
  REPORT_ENGINE: { fetch: async (r) => (seen.push([r.method, new URL(r.url).pathname, r.headers.get("stripe-signature"), await r.text()]), new Response("engine")) },
};
let r = await worker.fetch(new Request("https://autonomy-ladder.io/api/stripe/webhook", { method: "POST", body: "{\"a\":1}", headers: { "stripe-signature": "t=1,v1=x" } }), env, {});
assert.equal(await r.text(), "engine");
assert.deepEqual(seen[0], ["POST", "/api/stripe/webhook", "t=1,v1=x", "{\"a\":1}"]); // body and signature reach the engine untouched
r = await worker.fetch(new Request("https://autonomy-ladder.io/gap-report"), env, {});
assert.equal(await r.text(), "asset /gap-report"); // the form page is a static asset

// Engine missing or throwing: clear 503, never a blank page.
const down = { ASSETS: env.ASSETS };
r = await worker.fetch(new Request("https://autonomy-ladder.io/api/gap-report", { method: "POST", body: "{}" }), down, {});
assert.equal(r.status, 503); assert.match((await r.json()).error, /briefly unavailable/);
r = await worker.fetch(new Request("https://autonomy-ladder.io/gap-report/view?id=x"), { ...down, REPORT_ENGINE: { fetch: async () => { throw new Error("x"); } } }, {});
assert.equal(r.status, 503); assert.match(await r.text(), /briefly unavailable/);
console.log("gap report proxy: all tests passed");
