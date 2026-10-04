// Server-only: checks that links and images in an email actually load. Rules follow React Email's
// preview linter (resend/react-email, MIT License, Copyright 2024 Plus Five Five, Inc): a plain GET,
// redirects reported rather than followed (3xx = warning), other non-2xx = error, images over 1 MB = warning.
// Additions: a timeout, a content-type check for images, and refusing private/local addresses.
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

export type UrlKind = "link" | "image"
export type UrlResult = {
  url: string
  kind: UrlKind
  status: "ok" | "warning" | "error"
  message?: string
}

const MAX_IMAGE_BYTES = 1024 * 1024
const TIMEOUT_MS = 10_000

export function isPrivateAddress(ip: string) {
  const v4 = ip.toLowerCase().startsWith("::ffff:") ? ip.slice(7) : ip
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    )
  }
  const s = ip.toLowerCase()
  return s === "::" || s === "::1" || /^f[cd]/.test(s) || /^fe[89ab]/.test(s)
}

async function countBytes(res: Response, limit: number) {
  const reader = res.body?.getReader()
  let bytes = 0
  while (reader) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > limit) {
      await reader.cancel()
      break
    }
  }
  return bytes
}

export async function checkUrl(url: string, kind: UrlKind): Promise<UrlResult> {
  const result = (
    status: UrlResult["status"],
    message?: string
  ): UrlResult => ({
    url,
    kind,
    status,
    message,
  })
  let target: URL
  try {
    target = new URL(url)
  } catch {
    return result("error", "isn't a valid URL.")
  }
  if (target.protocol !== "https:" && target.protocol !== "http:")
    return result("error", "isn't an http(s) URL.")

  // ponytail: resolve-then-fetch leaves a DNS-rebinding window; pin the resolved IP if this ever
  // runs outside local development.
  const host = target.hostname.replace(/^\[|\]$/g, "")
  try {
    const addresses = isIP(host)
      ? [{ address: host }]
      : await lookup(host, { all: true })
    if (addresses.some((a) => isPrivateAddress(a.address)))
      return result(
        "error",
        "points to a private or local address, so recipients can't reach it (not checked)."
      )
  } catch {
    return result("error", `domain ${host} doesn't exist.`)
  }

  try {
    const res = await fetch(target, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "email-builder link checker" },
    })
    const code = res.status
    if (code >= 300 && code < 400) {
      await res.body?.cancel()
      const to = res.headers.get("location")
      return result("warning", `redirects (${code})${to ? ` to ${to}` : ""}.`)
    }
    if (code < 200 || code >= 300) {
      await res.body?.cancel()
      return result("error", `returned HTTP ${code}.`)
    }
    if (kind === "link") {
      await res.body?.cancel()
      return result("ok")
    }
    const type = res.headers.get("content-type") ?? ""
    const bytes = await countBytes(res, MAX_IMAGE_BYTES)
    if (!type.startsWith("image/"))
      return result(
        "warning",
        `isn't an image (content-type: ${type || "none"}).`
      )
    if (bytes > MAX_IMAGE_BYTES)
      return result(
        "warning",
        "is over 1 MB, which slows loading and may be clipped."
      )
    return result("ok")
  } catch (e) {
    return result(
      "error",
      e instanceof Error && e.name === "TimeoutError"
        ? `didn't respond within ${TIMEOUT_MS / 1000} seconds.`
        : "couldn't be reached."
    )
  }
}
