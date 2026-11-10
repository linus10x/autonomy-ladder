/**
 * Worker entry: POST /api/leads → KV LEADS; everything else → static assets.
 * Form posts keep the 303 to /thank-you; JSON posts return 200 {ok,id}.
 */

const MAX = {
  name: 120,
  email: 120,
  role: 80,
  firm_type: 80,
  interest: 80,
  notes: 1000,
  source: 40,
};

const INTERESTS = new Set([
  "self-score",
  "libraries",
  "builder",
  "operator",
  "services",
  "unsure",
]);

function bad(status, message) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function okRedirect(id) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/thank-you?lead=${encodeURIComponent(id)}`,
      "cache-control": "no-store",
    },
  });
}

function okJson(id) {
  return new Response(JSON.stringify({ ok: true, id }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

// After a lead is stored, ask the internal lead-notify Worker (desk-ops
// systems/lead-notify) to email the owner. Storage stays the source of truth:
// a missing binding or a failed notification never changes the response.
export function notifyOwner(env, ctx, record) {
  const svc = env && env.LEAD_NOTIFY;
  if (!svc || typeof svc.fetch !== "function") return false;
  const p = svc
    .fetch("https://lead-notify/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        site: "autonomy-ladder.io",
        kind: "governance inquiry",
        id: record.id,
        created_at: record.created_at,
        fields: {
          name: record.name,
          email: record.email,
          role: record.role,
          firm_type: record.firm_type,
          interest: record.interest,
          notes: record.notes,
          source: record.source,
        },
      }),
    })
    .catch(() => null);
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(p);
  return true;
}

function clip(value, n) {
  return String(value || "")
    .trim()
    .slice(0, n);
}

export async function handleLeads(request, env, ctx) {
  const ctype = request.headers.get("content-type") || "";
  const wantsJson = ctype.includes("application/json");
  let data;
  try {
    if (wantsJson) {
      data = await request.json();
    } else {
      const form = await request.formData();
      data = Object.fromEntries(form.entries());
    }
  } catch {
    return bad(400, "Could not read the form.");
  }

  const name = clip(data.name, MAX.name);
  const email = clip(data.email, MAX.email).toLowerCase();
  const role = clip(data.role, MAX.role);
  const firm_type = clip(data.firm_type, MAX.firm_type);
  const interest = clip(data.interest, MAX.interest);
  const notes = clip(data.notes, MAX.notes);
  const source = clip(data.source, MAX.source) || "leads";

  if (!email || !interest) {
    return bad(400, "Email and interest are required.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return bad(400, "Email looks invalid.");
  }
  if (!INTERESTS.has(interest)) {
    return bad(400, "Unknown interest.");
  }

  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const record = {
    id,
    created_at,
    name,
    email,
    role,
    firm_type,
    interest,
    notes,
    source,
  };

  try {
    if (env.LEADS) {
      await env.LEADS.put(`lead:${id}`, JSON.stringify(record), {
        metadata: { interest, created_at },
      });
      notifyOwner(env, ctx, record);
      return wantsJson ? okJson(id) : okRedirect(id);
    }
    if (env.DB) {
      await env.DB.prepare(
        `INSERT INTO leads (id, created_at, name, email, role, firm_type, interest, notes, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          created_at,
          name,
          email,
          role,
          firm_type,
          interest,
          notes,
          source,
        )
        .run();
      notifyOwner(env, ctx, record);
      return wantsJson ? okJson(id) : okRedirect(id);
    }
  } catch {
    return bad(500, "Could not store the lead.");
  }

  return bad(
    503,
    "Lead storage is not configured yet. Use the waitlist form or email contact@autonomy-ladder.io.",
  );
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/leads") {
      if (request.method === "POST") {
        return handleLeads(request, env, ctx);
      }
      return bad(405, "POST a lead to this URL.");
    }
    return env.ASSETS.fetch(request);
  },
};
