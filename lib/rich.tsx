import type { ReactNode } from "react"

// Rich text is stored as a tiny HTML subset: <b> <i> <u> <s> <a href="...">, with "\n" for line breaks.
// Text is entity-escaped (&amp; &lt; &gt;). Anything that isn't one of these exact tags stays literal
// text, so a stray "<script>" is shown as text, never run. Plain text is already valid rich text.

type Tag = "b" | "i" | "u" | "s" | "a"
export type Inline = string | { tag: Tag; href?: string; children: Inline[] }

const TAGS: Record<string, Tag> = {
  b: "b",
  strong: "b",
  i: "i",
  em: "i",
  u: "u",
  s: "s",
  strike: "s",
  del: "s",
  a: "a",
}
const TAG_RE =
  /<(\/?)(b|strong|i|em|u|s|strike|del|a)(?:\s+href="([^"]*)")?\s*>/gi
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  nbsp: " ",
}
const decode = (t: string) =>
  t.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTITIES[e])
export const escapeText = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const escapeAttr = (t: string) => escapeText(t).replace(/"/g, "&quot;")

export function parseInline(s: string): Inline[] {
  const root: Inline[] = []
  const stack: Extract<Inline, object>[] = []
  const top = () => (stack.length ? stack[stack.length - 1].children : root)
  let last = 0
  for (const m of s.matchAll(TAG_RE)) {
    if (m.index > last) top().push(decode(s.slice(last, m.index)))
    last = m.index + m[0].length
    const tag = TAGS[m[2].toLowerCase()]
    if (m[1]) {
      // Closing tag: close back to the nearest matching open tag; ignore it if there is none.
      const i = stack.map((n) => n.tag).lastIndexOf(tag)
      if (i >= 0) stack.length = i
    } else {
      const node = {
        tag,
        href: tag === "a" ? decode(m[3] ?? "") : undefined,
        children: [],
      }
      top().push(node)
      stack.push(node)
    }
  }
  if (last < s.length) top().push(decode(s.slice(last)))
  return root
}

const lines = (t: string, key: string) =>
  t
    .split("\n")
    .flatMap((line, i) => (i ? [<br key={`${key}-${i}`} />, line] : [line]))

// `safeUrl` is passed in so this module stays free of the email model.
export function renderInline(
  s: string,
  safeUrl: (u: string) => string | undefined
): ReactNode[] {
  const render = (nodes: Inline[], key: string): ReactNode[] =>
    nodes.flatMap((n, i): ReactNode[] => {
      const k = `${key}.${i}`
      if (typeof n === "string") return lines(n, k)
      const children = render(n.children, k)
      if (n.tag !== "a") {
        const T = n.tag
        return [<T key={k}>{children}</T>]
      }
      const href = n.href && safeUrl(n.href)
      return href
        ? [
            <a key={k} href={href}>
              {children}
            </a>,
          ]
        : children
    })
  return render(parseInline(s), "r")
}

export function plainText(s: string): string {
  const text = (nodes: Inline[]): string =>
    nodes
      .map((n) => {
        if (typeof n === "string") return n
        const inner = text(n.children)
        return n.tag === "a" && n.href && n.href !== inner
          ? `${inner} (${n.href})`
          : inner
      })
      .join("")
  return text(parseInline(s))
}

export function links(s: string): string[] {
  const out: string[] = []
  const walk = (nodes: Inline[]) =>
    nodes.forEach((n) => {
      if (typeof n === "string") return
      if (n.tag === "a" && n.href) out.push(n.href)
      walk(n.children)
    })
  walk(parseInline(s))
  return out
}

// Browser only: turns an edited contenteditable element back into stored rich text.
// Block elements (div, p, li) the browser inserts become line breaks; unknown tags keep only their text.
const BLOCKISH = new Set(["div", "p", "li"])
export function serializeRich(
  el: Element,
  safeUrl: (u: string) => string | undefined
): string {
  const walk = (n: Node): string => {
    if (n.nodeType === 3) return escapeText(n.textContent ?? "")
    if (n.nodeType !== 1) return ""
    const e = n as Element
    const name = e.tagName.toLowerCase()
    if (name === "br") return "\n"
    const inner = Array.from(e.childNodes, walk).join("")
    const tag = TAGS[name]
    if (tag === "a") {
      const href = e.getAttribute("href") ?? ""
      return safeUrl(href)
        ? `<a href="${escapeAttr(href)}">${inner}</a>`
        : inner
    }
    if (tag) return inner ? `<${tag}>${inner}</${tag}>` : ""
    return BLOCKISH.has(name) ? `\n${inner}` : inner
  }
  return Array.from(el.childNodes, walk)
    .join("")
    .replace(/^\n/, "")
    .replace(/\n$/, "")
}
