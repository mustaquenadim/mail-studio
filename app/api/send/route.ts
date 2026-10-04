// Sends a test email through Resend. Configure in .env.local:
//   RESEND_API_KEY=re_...
//   RESEND_FROM="Name <you@your-verified-domain.com>"  (optional; defaults to Resend's test sender,
//   which can only deliver to your own Resend account's email address)
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

export async function POST(request: Request) {
  // ponytail: dev-only, so a deployed copy can't send mail with your key. Add auth before allowing it in production.
  if (process.env.NODE_ENV === "production")
    return Response.json(
      { error: "Test sending is disabled in production." },
      { status: 403 }
    )

  // Requiring JSON forces a CORS preflight, so other sites can't trigger sends from your browser.
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ error: "Expected a JSON body." }, { status: 415 })

  const key = process.env.RESEND_API_KEY
  if (!key)
    return Response.json(
      {
        error: "Set RESEND_API_KEY in .env.local, then restart the dev server.",
      },
      { status: 501 }
    )

  const body: unknown = await request.json().catch(() => null)
  const { to, subject, html, text } = (body ?? {}) as Record<string, unknown>
  if (typeof to !== "string" || !EMAIL.test(to))
    return Response.json(
      { error: "Enter a valid recipient email address." },
      { status: 400 }
    )
  if (typeof subject !== "string" || !subject.trim() || subject.length > 200)
    return Response.json(
      { error: "Enter a subject (up to 200 characters)." },
      { status: 400 }
    )
  if (typeof html !== "string" || typeof text !== "string")
    return Response.json({ error: "Missing email content." }, { status: 400 })

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM ?? "Email builder <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
      text,
    }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    id?: string
    message?: string
  }
  if (!res.ok)
    return Response.json(
      { error: data.message ?? `Resend returned ${res.status}.` },
      { status: 502 }
    )
  return Response.json({ id: data.id })
}
