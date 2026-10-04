// Sends a test email. Credentials come with each request (nothing is stored):
//   ethereal: a throwaway Ethereal inbox; nothing is delivered, you get a link to view the message.
//   smtp:     any SMTP server (host, port, user, password).
//   resend:   a Resend API key; falls back to RESEND_API_KEY / RESEND_FROM in .env.local.
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import nodemailer from "nodemailer"
import { isPrivateAddress } from "@/lib/url-check"

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/
const MAX_TO = 10
type Obj = Record<string, unknown>
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
const fail = (error: string, status = 400) =>
  Response.json({ error }, { status })

// The server connects to whatever host it's given, so refuse private/local addresses.
async function publicHost(host: string) {
  try {
    const addrs = isIP(host)
      ? [{ address: host }]
      : await lookup(host, { all: true })
    return !addrs.some((a) => isPrivateAddress(a.address))
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  // ponytail: dev-only, so a deployed copy isn't an open mail relay. Add auth before allowing it in production.
  if (process.env.NODE_ENV === "production")
    return fail("Test sending is disabled in production.", 403)

  // Requiring JSON forces a CORS preflight, so other sites can't trigger sends from your browser.
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return fail("Expected a JSON body.", 415)

  const body = ((await request.json().catch(() => null)) ?? {}) as Obj
  const mode = body.mode ?? "resend"
  const to = (Array.isArray(body.to) ? body.to : [body.to]).map(str)
  const subject = str(body.subject)
  const { html, text } = body
  if (!to.length || to.length > MAX_TO || !to.every((t) => EMAIL.test(t)))
    return fail(`Enter 1 to ${MAX_TO} valid recipient addresses.`)
  if (!subject || subject.length > 200)
    return fail("Enter a subject (up to 200 characters).")
  if (typeof html !== "string" || typeof text !== "string")
    return fail("Missing email content.")
  const from = str(body.from)
  if (from && !/[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/.test(from))
    return fail("The From address isn't valid.")

  if (mode === "resend") {
    const key = str(body.resendKey) || process.env.RESEND_API_KEY
    if (!key)
      return fail(
        "Enter a Resend API key, or set RESEND_API_KEY in .env.local.",
        501
      )
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:
          from ||
          process.env.RESEND_FROM ||
          "Email builder <onboarding@resend.dev>",
        to,
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
      return fail(data.message ?? `Resend returned ${res.status}.`, 502)
    return Response.json({ id: data.id })
  }

  if (mode !== "smtp" && mode !== "ethereal") return fail("Unknown mode.")

  try {
    let transport
    let sender = from
    if (mode === "ethereal") {
      const acct = await nodemailer.createTestAccount()
      transport = nodemailer.createTransport({
        host: acct.smtp.host,
        port: acct.smtp.port,
        secure: acct.smtp.secure,
        auth: { user: acct.user, pass: acct.pass },
      })
      sender ||= acct.user
    } else {
      const smtp = (body.smtp ?? {}) as Obj
      const host = str(smtp.host)
      const port = Number(smtp.port)
      if (!host || !Number.isInteger(port) || port < 1 || port > 65535)
        return fail("Enter an SMTP host and port.")
      if (!(await publicHost(host)))
        return fail("That SMTP host doesn't resolve to a public address.")
      transport = nodemailer.createTransport({
        host,
        port,
        secure: smtp.secure === true,
        auth: str(smtp.user)
          ? { user: str(smtp.user), pass: String(smtp.pass ?? "") }
          : undefined,
        connectionTimeout: 15_000,
      })
      sender ||= str(smtp.user)
      if (!EMAIL.test(sender.replace(/^.*<|>$/g, "")))
        return fail("Enter a From address.")
    }
    const info = await transport.sendMail({
      from: sender,
      to,
      subject,
      html,
      text,
    })
    return Response.json({
      id: info.messageId,
      previewUrl:
        mode === "ethereal"
          ? nodemailer.getTestMessageUrl(info) || undefined
          : undefined,
    })
  } catch (e) {
    return fail(
      `Sending failed: ${e instanceof Error ? e.message : String(e)}`,
      502
    )
  }
}
