import { checkUrl, type UrlKind, type UrlResult } from "@/lib/url-check"

const MAX_URLS = 100
const CONCURRENCY = 6

export async function POST(request: Request) {
  // ponytail: dev-only, because the server fetches whatever URLs it's given. Add auth (and pin
  // resolved IPs) before enabling this in production.
  if (process.env.NODE_ENV === "production")
    return Response.json(
      { error: "Link checking is disabled in production." },
      { status: 403 }
    )
  // Requiring JSON forces a CORS preflight, so other sites can't trigger checks from your browser.
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ error: "Expected a JSON body." }, { status: 415 })

  const body = (await request.json().catch(() => null)) as {
    targets?: unknown
  } | null
  const targets = Array.isArray(body?.targets) ? body.targets : null
  const valid =
    targets &&
    targets.length <= MAX_URLS &&
    targets.every(
      (t): t is { url: string; kind: UrlKind } =>
        typeof t?.url === "string" &&
        t.url.length <= 2048 &&
        (t.kind === "link" || t.kind === "image")
    )
  if (!valid)
    return Response.json(
      { error: `Send up to ${MAX_URLS} { url, kind } targets.` },
      { status: 400 }
    )

  const queue = [...targets]
  const results: UrlResult[] = []
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let t = queue.shift(); t; t = queue.shift())
        results.push(await checkUrl(t.url, t.kind))
    })
  )
  return Response.json({ results })
}
