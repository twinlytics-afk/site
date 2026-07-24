export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();
    const name = form.get("name") || "";
    const email = form.get("email") || "";
    const company = form.get("company") || "";
    const message = form.get("message") || "";
    const text = `New lead from twinslytics.com\n*${name}* <${email}> ${company}\n${message}`;
    if (env.SLACK_WEBHOOK_URL) {
      await fetch(env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
}
