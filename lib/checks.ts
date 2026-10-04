import { isContainer, safeUrl, type Block, type EmailDoc } from "./email"
import { links, plainText } from "./rich"

export type Level = "error" | "warning" | "info"
export type Finding = {
  level: Level
  message: string
  blockId?: string
  detail?: string // secondary text, e.g. caniemail notes
  href?: string // "Learn more" link
}

export const allBlocks = (blocks: Block[]): Block[] =>
  blocks.flatMap((b) => [b, ...(isContainer(b) ? allBlocks(b.children) : [])])

// Every http(s) URL the email loads or links to, with the block it's in (for the network check).
export type UrlTarget = { url: string; kind: "link" | "image"; blockId: string }
export function urlTargets(doc: EmailDoc): UrlTarget[] {
  const out: UrlTarget[] = []
  for (const b of allBlocks(doc.blocks)) {
    const add = (url: string, kind: UrlTarget["kind"]) => {
      const safe = safeUrl(url)
      if (safe && /^https?:/i.test(safe))
        out.push({ url: safe, kind, blockId: b.id })
    }
    if (b.type === "image") {
      add(b.src, "image")
      add(b.href, "link")
    }
    if (b.type === "button") add(b.href, "link")
    const rich =
      "items" in b
        ? b.items
        : "body" in b && b.type !== "code"
          ? b.body
          : "text" in b && b.type !== "button"
            ? b.text
            : ""
    for (const href of links(rich)) add(href, "link")
  }
  return out
}

// WCAG relative luminance and contrast ratio for #rrggbb colors.
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const GMAIL_CLIP_KB = 102

export function lint(doc: EmailDoc, html: string): Finding[] {
  const out: Finding[] = []

  const visit = (blocks: Block[], bg: string) =>
    blocks.forEach((b) => {
      const add = (level: Level, message: string) =>
        out.push({ level, message, blockId: b.id })
      const checkContrast = (
        fg: string,
        back: string,
        min: number,
        what: string
      ) => {
        const ratio = contrast(fg, back)
        if (ratio < min)
          add(
            "warning",
            `${what} contrast is ${ratio.toFixed(1)}:1; aim for at least ${min}:1.`
          )
      }

      const insecure = (url: string) => /^http:/i.test(url.trim())
      const warnInsecure = (url: string, what: string) => {
        if (insecure(url))
          add("warning", `${what} uses http://. Use https:// so it's secure.`)
      }

      // Links inside formatted text that would be dropped on render.
      const checkLinks = (rich: string) => {
        const hrefs = links(rich)
        if (hrefs.some((href) => !safeUrl(href)))
          add(
            "error",
            "A link in this text isn't a valid http(s) or mailto URL, so it's removed."
          )
        if (hrefs.some(insecure))
          add("warning", "A link in this text uses http://. Use https://.")
      }

      switch (b.type) {
        case "title":
        case "subtitle":
        case "heading":
          if (!plainText(b.text).trim()) add("warning", "Heading is empty.")
          checkLinks(b.text)
          checkContrast(b.color, bg, 3, "Heading")
          break
        case "text":
        case "quote":
          if (!plainText(b.body).trim())
            add("warning", `${b.type === "text" ? "Text" : "Quote"} is empty.`)
          checkLinks(b.body)
          checkContrast(b.color, bg, 4.5, "Text")
          break
        case "code":
          if (!b.body.trim()) add("warning", "Code block is empty.")
          checkContrast(b.color, b.bg, 4.5, "Code")
          break
        case "bulletList":
        case "numberedList":
          if (!plainText(b.items).trim()) add("warning", "List has no items.")
          checkLinks(b.items)
          checkContrast(b.color, bg, 4.5, "List text")
          break
        case "button":
          if (!b.text.trim()) add("error", "Button has no label.")
          if (!safeUrl(b.href))
            add(
              "error",
              "Button link isn't a valid http(s) or mailto URL, so it won't link anywhere."
            )
          warnInsecure(b.href, "Button link")
          checkContrast(b.color, b.bg, 4.5, "Button text")
          break
        case "image":
          if (!safeUrl(b.src))
            add(
              "error",
              "Image has no valid URL (it must start with https://)."
            )
          else if (!/^https:/i.test(b.src.trim()))
            add(
              "warning",
              "Image uses http://. Many clients block or flag insecure images; use https://."
            )
          if (b.href.trim() && !safeUrl(b.href))
            add(
              "error",
              "Image link isn't a valid http(s) or mailto URL, so it's dropped."
            )
          warnInsecure(b.href, "Image link")
          if (!b.alt.trim())
            add(
              b.href.trim() ? "error" : "warning",
              b.href.trim()
                ? "Linked image has no alt text, so the link has no accessible name."
                : "Image has no alt text. Screen readers read it, and clients show it when images are blocked."
            )
          break
        case "section":
          if (!b.children.length) add("info", "Section is empty.")
          visit(b.children, b.bg)
          break
        case "columns":
          b.children.forEach((c) => {
            if (isContainer(c)) visit(c.children, bg)
          })
          break
      }
    })

  visit(doc.blocks, doc.settings.contentBg)

  if (!doc.blocks.length)
    out.push({ level: "info", message: "The email is empty." })
  if (doc.settings.width > 640)
    out.push({
      level: "warning",
      message: `Content width is ${doc.settings.width}px. Most clients show about 600px, so wider emails scroll sideways.`,
    })
  const kb = new TextEncoder().encode(html).length / 1024
  if (kb > GMAIL_CLIP_KB)
    out.push({
      level: "error",
      message: `HTML is ${kb.toFixed(0)}KB. Gmail clips messages over ${GMAIL_CLIP_KB}KB.`,
    })
  else if (kb > GMAIL_CLIP_KB * 0.8)
    out.push({
      level: "warning",
      message: `HTML is ${kb.toFixed(0)}KB, close to Gmail's ${GMAIL_CLIP_KB}KB clipping limit.`,
    })

  return out
}

const SPAM_PHRASES = [
  "100% free",
  "act now",
  "buy now",
  "cash bonus",
  "click here",
  "double your",
  "earn money",
  "free money",
  "guaranteed",
  "limited time",
  "miracle",
  "no cost",
  "order now",
  "risk-free",
  "urgent",
  "winner",
  "you have been selected",
  "$$$",
]
const SHORTENERS =
  /\b(bit\.ly|tinyurl\.com|goo\.gl|t\.co|ow\.ly|is\.gd|buff\.ly)\//i

// Heuristics only: real filters also weigh SPF/DKIM/DMARC and sender reputation.
export function spam(doc: EmailDoc, text: string): Finding[] {
  const out: Finding[] = []
  const lower = text.toLowerCase()
  const blocks = allBlocks(doc.blocks)

  const phrases = SPAM_PHRASES.filter((p) => lower.includes(p))
  if (phrases.length)
    out.push({
      level: "warning",
      message: `Common spam phrases: "${phrases.join('", "')}".`,
    })

  const words = text.match(/\b[A-Za-z]{3,}\b/g) ?? []
  const caps = words.filter((w) => w === w.toUpperCase())
  if (words.length >= 10 && caps.length / words.length > 0.3)
    out.push({
      level: "warning",
      message: `${Math.round((caps.length / words.length) * 100)}% of words are in ALL CAPS.`,
    })

  const bangs = (text.match(/!/g) ?? []).length
  if (/!{2,}/.test(text) || bangs > 5)
    out.push({
      level: "warning",
      message: `Lots of exclamation marks (${bangs}).`,
    })

  const images = blocks.filter((b) => b.type === "image").length
  const chars = text
    .replace(/\S+:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim().length
  if (images && chars < 100)
    out.push({
      level: "warning",
      message:
        "Mostly images with very little text. Image-only emails are often filtered.",
    })
  else if (images && chars / images < 200)
    out.push({
      level: "info",
      message: "Low text-to-image ratio. Aim for more text alongside images.",
    })

  const urls = blocks.flatMap((b) => [
    ...("href" in b && b.href ? [b.href] : []),
    ...("body" in b && b.type !== "code" ? links(b.body) : []),
    ...("items" in b ? links(b.items) : []),
    ...("text" in b && b.type !== "button" ? links(b.text) : []),
  ])
  const short = urls.filter((l) => SHORTENERS.test(l))
  if (short.length)
    out.push({
      level: "warning",
      message: `Link shorteners are a common spam signal: ${short.join(", ")}`,
    })

  if (blocks.length && !lower.includes("unsubscribe"))
    out.push({
      level: "warning",
      message:
        "No unsubscribe link found. Marketing emails need one, and leaving it out raises spam risk.",
    })

  return out
}
