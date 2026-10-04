// Email client compatibility from caniemail.com data, modelled on React Email's preview server
// (resend/react-email, MIT License, Copyright 2024 Plus Five Five, Inc). Like theirs, it reports
// features the email uses that are unsupported in at least one platform of the checked clients,
// using each platform's latest tested version. Unlike theirs, it reads the rendered HTML, since
// this builder has no hand-written source to parse.

import type { Finding } from "./checks"

export type CaniEntry = {
  slug: string
  title: string
  category: string
  url: string
  // family -> platform -> versions oldest-first, each { "version": "y" | "n" | "a #1" | "u" }
  stats: Record<string, Record<string, Record<string, string>[]>>
  notes_by_num: Record<string, string> | null
}
export type CaniData = {
  nicenames: {
    family: Record<string, string>
    platform: Record<string, string>
  }
  data: CaniEntry[]
}

// React Email's default set.
export const FAMILIES = ["gmail", "apple-mail", "outlook", "yahoo"]

export type Features = {
  elements: Set<string>
  attributes: Set<string>
  declarations: { prop: string; value: string }[]
  atRules: Set<string>
  mediaFeatures: Set<string>
}

const parseDeclarations = (css: string) =>
  css
    .split(";")
    .map((d) => [d.slice(0, d.indexOf(":")), d.slice(d.indexOf(":") + 1)])
    .filter(([p, v]) => p?.trim() && v?.trim())
    .map(([p, v]) => ({
      prop: p.trim().toLowerCase(),
      value: v.trim().toLowerCase(),
    }))

// The input is our own renderToStaticMarkup output, so a regex scan is reliable here.
export function usedFeatures(source: string): Features {
  // Skip comments: the Outlook-only <!--[if mso]> markup isn't seen by other clients.
  const html = source.replace(/<!--[\s\S]*?-->/g, "")
  const f: Features = {
    elements: new Set(),
    attributes: new Set(),
    declarations: [],
    atRules: new Set(),
    mediaFeatures: new Set(),
  }
  for (const tag of html.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g)) {
    f.elements.add(tag[1].toLowerCase())
    for (const a of tag[2].matchAll(
      /([a-zA-Z_:][-\w:.]*)(?:\s*=\s*"([^"]*)")?/g
    )) {
      const name = a[1].toLowerCase()
      f.attributes.add(name)
      if (name === "style")
        f.declarations.push(...parseDeclarations(a[2] ?? ""))
    }
  }
  for (const style of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    const css = style[1]
    for (const at of css.matchAll(/@([a-z-]+)([^{]*)\{/gi)) {
      f.atRules.add(at[1].toLowerCase())
      for (const feature of at[2].matchAll(/\(\s*([a-z-]+)/gi))
        f.mediaFeatures.add(feature[1].toLowerCase())
    }
    for (const block of css.matchAll(/\{([^{}]*)\}/g))
      f.declarations.push(...parseDeclarations(block[1]))
  }
  return f
}

// Turns a caniemail entry's title into a check against what the email uses.
// Titles we can't interpret confidently (functions, units, selectors) never match.
export function entryMatches(entry: CaniEntry, f: Features): boolean {
  const title = entry.title.trim()
  if (entry.category === "html") {
    const tags = [...title.matchAll(/<([a-z0-9]+)>/gi)].map((m) =>
      m[1].toLowerCase()
    )
    if (tags.length) return tags.some((t) => f.elements.has(t))
    const attr = title.match(/^([a-z-]+) attribute$/i)
    return !!attr && f.attributes.has(attr[1].toLowerCase())
  }
  if (entry.category !== "css") return false
  if (title.startsWith("@")) {
    return [...title.matchAll(/@([a-z-]+)(?:\s*\(\s*([a-z-]+)\s*\))?/gi)].some(
      ([, rule, feature]) =>
        feature
          ? f.mediaFeatures.has(feature.toLowerCase())
          : f.atRules.has(rule.toLowerCase())
    )
  }
  const pair = title.match(/^([a-z-]+)\s*:\s*([a-z0-9-]+)$/i)
  if (pair) {
    const [prop, value] = [pair[1].toLowerCase(), pair[2].toLowerCase()]
    return f.declarations.some((d) => d.prop === prop && d.value === value)
  }
  const props = title.split(/,|&/).map((t) => t.trim().toLowerCase())
  if (!props.every((p) => /^[a-z]+(-[a-z]+)*$/.test(p))) return false
  return f.declarations.some((d) => props.includes(d.prop))
}

const latest = (versions: Record<string, string>[]) => {
  const last = versions[versions.length - 1]
  return last ? (Object.values(last)[0] ?? "u") : "u"
}

// Markdown links -> their text; caniemail notes are markdown.
const plainNote = (n: string) =>
  n.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/`/g, "")

export function compatibilityFindings(
  html: string,
  { nicenames, data }: CaniData,
  families = FAMILIES
): Finding[] {
  const f = usedFeatures(html)
  const out: Finding[] = []
  for (const entry of data) {
    if (!entryMatches(entry, f)) continue
    const unsupported: string[] = []
    const notes = new Set<string>()
    for (const family of families) {
      const platforms = Object.entries(entry.stats[family] ?? {}).filter(
        ([, v]) => latest(v).startsWith("n")
      )
      if (!platforms.length) continue
      const names = platforms
        .map(([p]) => nicenames.platform[p] ?? p)
        .join(", ")
      unsupported.push(`${nicenames.family[family] ?? family} (${names})`)
      for (const [, versions] of platforms)
        for (const m of latest(versions).matchAll(/#(\d+)/g)) {
          const note = entry.notes_by_num?.[m[1]]
          if (note) notes.add(plainNote(note))
        }
    }
    if (!unsupported.length) continue
    out.push({
      level: "warning",
      message: `${entry.title} isn't supported in ${unsupported.join(", ")}.`,
      detail: [...notes].join(" ") || undefined,
      href: entry.url,
    })
  }
  return out
}
