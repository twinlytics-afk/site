// Simple view counter backed by Cloudflare KV (binding name: VIEWS).
// POST /api/views?p=/blog-xyz.html  -> increments and returns count
// GET  /api/views                    -> returns { "/blog-xyz.html": 123, ... }
export async function onRequest({ request, env }) {
  const cors = { "access-control-allow-origin": "*", "content-type": "application/json" };
  const kv = env.VIEWS;
  if (!kv) return new Response(JSON.stringify({ error: "KV binding VIEWS not set" }), { status: 500, headers: cors });

  const url = new URL(request.url);
  if (request.method === "POST") {
    const p = (url.searchParams.get("p") || "").slice(0, 160);
    if (!p || !p.startsWith("/")) return new Response(JSON.stringify({ ok: false }), { headers: cors });
    const n = (parseInt(await kv.get(p), 10) || 0) + 1;
    await kv.put(p, String(n));
    return new Response(JSON.stringify({ ok: true, p, count: n }), { headers: cors });
  }

  const list = await kv.list({ limit: 1000 });
  const out = {};
  for (const k of list.keys) out[k.name] = parseInt(await kv.get(k.name), 10) || 0;
  return new Response(JSON.stringify(out), { headers: cors });
}
