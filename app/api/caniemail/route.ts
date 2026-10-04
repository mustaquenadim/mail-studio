// Proxies caniemail.com's data (~700KB, updated by them every few weeks), cached for a day and
// trimmed to what the Compatibility tab needs. Fixed upstream URL, so this is safe in production.
import { FAMILIES, type CaniData, type CaniEntry } from "@/lib/compat"

const SOURCE = "https://www.caniemail.com/api/data-ordered.json"

export async function GET() {
  const res = await fetch(SOURCE, { next: { revalidate: 86400 } }).catch(
    () => null
  )
  if (!res?.ok)
    return Response.json(
      { error: "Couldn't load caniemail.com data." },
      { status: 502 }
    )
  const raw = (await res.json()) as CaniData & { data: CaniEntry[] }
  const body: CaniData = {
    nicenames: raw.nicenames,
    data: raw.data.map((e) => ({
      slug: e.slug,
      title: e.title,
      category: e.category,
      url: e.url,
      notes_by_num: e.notes_by_num,
      stats: Object.fromEntries(FAMILIES.map((f) => [f, e.stats[f] ?? {}])),
    })),
  }
  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=3600" },
  })
}
