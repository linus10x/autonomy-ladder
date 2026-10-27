/**
 * POST /api/leads — store a conversion lead. No email is sent from this handler.
 *
 * Bindings (Cloudflare Pages):
 *   LEADS — KV namespace (preferred)
 *   DB    — D1 with table `leads` (optional)
 *
 * Kit waitlist forms stay separate. This path is for buyers who want a stored
 * request without the Kit confirm mail. If neither binding is set, returns 503.
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

function ok(id) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/thank-you?lead=${encodeURIComponent(id)}`,
      "cache-control": "no-store",
    },
  });
}

function clip(value, n) {
  return String(value || "")
    .trim()
    .slice(0, n);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const ctype = request.headers.get("content-type") || "";
  let data;
  try {
    if (ctype.includes("application/json")) {
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
      return ok(id);
    }
    if (env.DB) {
      await env.DB.prepare(
        `INSERT INTO leads (id, created_at, name, email, role, firm_type, interest, notes, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
          source
        )
        .run();
      return ok(id);
    }
  } catch {
    return bad(500, "Could not store the lead.");
  }

  return bad(
    503,
    "Lead storage is not configured yet. Use the waitlist form or email contact@autonomy-ladder.io."
  );
}

export async function onRequestGet() {
  return bad(405, "POST a lead to this URL.");
}
