// Conversions between the block model and MJML, Markdown and HTML.
// Exports are plain string building; imports parse with DOMParser (browser only) or line by line,
// build a doc, then go through parseDoc so they're validated like any other untrusted JSON.
import {
  DEFAULT_SETTINGS,
  DEFAULTS,
  FONTS,
  ICONS,
  allBlocks,
  fontUrls,
  isContainer,
  lines,
  listItems,
  pairs,
  parseDoc,
  safeUrl,
  socialOf,
  tableRows,
  type Block,
  type BlockType,
  type EmailDoc,
} from "./email"
import {
  escapeAttr,
  escapeText,
  parseInline,
  serializeRich,
  type Inline,
} from "./rich"

type Leaf = Exclude<Block, { children: Block[] }>
type Attrs = Record<string, string | number | false | undefined>

// --- MJML export ---

const attrs = (o: Attrs) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== "" && v !== false)
    .map(([k, v]) => ` ${k}="${escapeAttr(String(v))}"`)
    .join("")
// Tags that hold other MJML tags get their children on their own lines, for reading.
const NESTING =
  /^mj-(section|column|group|wrapper|hero|navbar|social|accordion|accordion-element|carousel)$/
const tag = (name: string, a: Attrs, inner?: string) =>
  inner === undefined
    ? `<${name}${attrs(a)} />`
    : NESTING.test(name) && inner
      ? `<${name}${attrs(a)}>
${inner}
</${name}>`
      : `<${name}${attrs(a)}>${inner}</${name}>`
const px = (n: number) => `${n}px`

// The rich-text subset as HTML, re-checked: text escaped, only safe links kept.
// Links take the text color, as in the HTML export.
function richHtml(s: string, color: string): string {
  const walk = (nodes: Inline[]): string =>
    nodes
      .map((n) => {
        if (typeof n === "string") return escapeText(n).replace(/\n/g, "<br />")
        const inner = walk(n.children)
        if (n.tag !== "a") return `<${n.tag}>${inner}</${n.tag}>`
        const href = n.href && safeUrl(n.href)
        return href
          ? `<a href="${escapeAttr(href)}" style="color:${color};text-decoration:underline">${inner}</a>`
          : inner
      })
      .join("")
  return walk(parseInline(s))
}

const fontAttrs = (b: {
  fontFamily: keyof typeof FONTS
  fontSize: number
  fontWeight: string
  lineHeight: number
}) => ({
  "font-family": FONTS[b.fontFamily],
  "font-size": px(b.fontSize),
  "font-weight": b.fontWeight,
  "line-height": b.lineHeight,
})

const H = { title: "h1", subtitle: "h2", heading: "h3" } as const

function leafMjml(b: Leaf, width: number): string {
  const pad = "spacing" in b ? `${b.spacing}px 0` : undefined
  switch (b.type) {
    case "title":
    case "subtitle":
    case "heading":
      return tag(
        "mj-text",
        { color: b.color, align: b.align, padding: pad, ...fontAttrs(b) },
        `<${H[b.type]} style="margin:0;font-size:${b.fontSize}px;font-weight:${b.fontWeight}">${richHtml(b.text, b.color)}</${H[b.type]}>`
      )
    case "text":
      return tag(
        "mj-text",
        { color: b.color, align: b.align, padding: pad, ...fontAttrs(b) },
        richHtml(b.body, b.color)
      )
    case "bulletList":
    case "numberedList": {
      const l = b.type === "bulletList" ? "ul" : "ol"
      const items = listItems(b.items)
        .map((i) => `<li>${richHtml(i, b.color)}</li>`)
        .join("")
      return tag(
        "mj-text",
        { color: b.color, padding: pad, ...fontAttrs(b) },
        `<${l} style="margin:0;padding-left:24px">${items}</${l}>`
      )
    }
    case "quote":
      return tag(
        "mj-text",
        { color: b.color, padding: pad, ...fontAttrs(b) },
        `<blockquote style="margin:0;border-left:4px solid ${b.borderColor};padding-left:16px;font-style:italic">${richHtml(b.body, b.color)}</blockquote>`
      )
    case "code":
      return tag(
        "mj-text",
        {
          color: b.color,
          "container-background-color": b.bg,
          "font-family": "Menlo, Consolas, monospace",
          "font-size": "14px",
          padding: "16px",
        },
        `<pre style="margin:0;white-space:pre-wrap">${escapeText(b.body)}</pre>`
      )
    case "button":
      return tag(
        "mj-button",
        {
          href: safeUrl(b.href),
          "background-color": b.bg,
          color: b.color,
          "border-radius": px(b.radius),
          align: b.align,
          width: b.fullWidth && "100%",
          "inner-padding": "12px 24px",
          padding: pad,
          ...fontAttrs(b),
        },
        escapeText(b.text)
      )
    case "divider":
      return tag("mj-divider", {
        "border-color": b.color,
        "border-width": px(b.thickness),
        padding: pad,
      })
    case "image":
      return tag("mj-image", {
        src: safeUrl(b.src),
        alt: b.alt,
        href: safeUrl(b.href),
        width: px(
          Math.round((width * Math.max(1, Math.min(100, b.size))) / 100)
        ),
        align: b.align,
        "border-radius": b.radius ? px(b.radius) : undefined,
        padding: pad,
      })
    case "spacer":
      return tag("mj-spacer", { height: px(b.height) })
    case "navbar":
      return tag(
        "mj-navbar",
        { align: b.align, hamburger: undefined },
        pairs(b.links)
          .map(([label, url]) =>
            tag(
              "mj-navbar-link",
              {
                href: safeUrl(url),
                color: b.color,
                "font-family": FONTS[b.fontFamily],
                "font-size": px(b.fontSize),
                "font-weight": b.fontWeight,
                padding: "0 12px",
              },
              escapeText(label)
            )
          )
          .join("\n")
      )
    case "social":
      return tag(
        "mj-social",
        {
          mode: b.socialMode,
          align: b.align,
          "icon-size": px(b.iconSize),
          padding: pad,
        },
        pairs(b.networks)
          .map(([name, url]) => {
            const net = socialOf(name)
            return tag(
              "mj-social-element",
              {
                name: `${name.toLowerCase()}-noshare`,
                href: safeUrl(url),
                src: `${ICONS}${net.icon}.png`,
                alt: name,
                "background-color": net.bg,
              },
              ""
            )
          })
          .join("\n")
      )
    case "accordion":
      return tag(
        "mj-accordion",
        {
          border: `1px solid ${b.borderColor}`,
          "font-family": FONTS[b.fontFamily],
          padding: pad,
        },
        pairs(b.panels)
          .map(([title, body]) =>
            tag(
              "mj-accordion-element",
              {},
              tag(
                "mj-accordion-title",
                { "background-color": b.bg, color: b.color },
                escapeText(title)
              ) +
                tag(
                  "mj-accordion-text",
                  { color: b.color, "font-size": px(b.fontSize) },
                  escapeText(body)
                )
            )
          )
          .join("\n")
      )
    case "carousel":
      return tag(
        "mj-carousel",
        { "border-radius": px(b.radius), padding: pad },
        lines(b.images)
          .map((src) => tag("mj-carousel-image", { src: safeUrl(src) }))
          .join("\n")
      )
    case "table": {
      const cell = `border:1px solid ${b.borderColor};padding:${b.cellPadding}px;text-align:left`
      const rows = tableRows(b.rows)
        .map(
          (r, i) =>
            `<tr>${r
              .map((c) =>
                b.header && i === 0
                  ? `<th style="${cell};font-weight:600;background-color:#f4f4f5">${escapeText(c)}</th>`
                  : `<td style="${cell}">${escapeText(c)}</td>`
              )
              .join("")}</tr>`
        )
        .join("")
      return tag(
        "mj-table",
        {
          color: b.color,
          cellpadding: "0",
          padding: pad,
          ...fontAttrs(b),
        },
        rows
      )
    }
    case "raw":
      return `<mj-raw>${b.html}</mj-raw>`
  }
}

const column = (children: Block[], width: number, a: Attrs = {}) =>
  tag(
    "mj-column",
    a,
    children
      .map((c) => (isContainer(c) ? "" : leafMjml(c as Leaf, width)))
      .join("\n")
  )

function columnsMjml(b: Extract<Block, { type: "columns" }>, width: number) {
  const n = b.children.length
  const w = Math.floor((width - b.gap * (n - 1)) / n)
  const cols = b.children
    .map((c, i) =>
      column(isContainer(c) ? c.children : [], w, {
        "padding-left": i ? px(b.gap / 2) : undefined,
        "padding-right": i < n - 1 ? px(b.gap / 2) : undefined,
      })
    )
    .join("\n")
  // mj-group keeps columns side by side on mobile.
  return b.stackOnMobile ? cols : tag("mj-group", {}, cols)
}

// A section's children as MJML sections: runs of leaves become one column; a columns block its own row.
function rows(
  children: Block[],
  width: number,
  a: Attrs,
  padding: number,
  padX = padding
) {
  const parts: Block[][] = []
  for (const c of children) {
    const prev = parts[parts.length - 1]
    if (c.type !== "columns" && prev && prev[0].type !== "columns") prev.push(c)
    else parts.push([c])
  }
  if (!parts.length) parts.push([])
  const inner = width - 2 * padX
  return parts
    .map((p, i) =>
      tag(
        "mj-section",
        {
          ...a,
          "css-class":
            [a["css-class"], i && CONT].filter(Boolean).join(" ") || undefined,
          padding: `${i === 0 ? padding : 0}px ${padX}px ${i === parts.length - 1 ? padding : 0}px`,
        },
        p[0]?.type === "columns" ? columnsMjml(p[0], inner) : column(p, inner)
      )
    )
    .join("\n")
}

function topMjml(b: Block, width: number): string {
  switch (b.type) {
    case "section":
      return rows(
        b.children,
        width,
        {
          "background-color": b.bg,
          "background-url": safeUrl(b.bgImage),
          "background-size": b.bgImage ? "cover" : undefined,
        },
        b.padding
      )
    case "wrapper":
      return tag(
        "mj-wrapper",
        {
          "background-color": b.bg,
          border: `1px solid ${b.borderColor}`,
          "border-radius": b.radius ? px(b.radius) : undefined,
          padding: px(b.padding),
        },
        b.children.map((c) => topMjml(c, width - 2 * b.padding)).join("\n")
      )
    case "hero":
      return tag(
        "mj-hero",
        {
          mode: "fixed-height",
          height: px(b.height),
          "background-color": b.bg,
          "background-url": safeUrl(b.bgImage),
          "background-height": safeUrl(b.bgImage) ? px(b.height) : undefined,
          "background-width": safeUrl(b.bgImage) ? px(width) : undefined,
          "vertical-align": b.vAlign,
          padding: px(b.padding),
        },
        b.children
          .map((c) =>
            isContainer(c) ? "" : leafMjml(c as Leaf, width - 2 * b.padding)
          )
          .join("\n")
      )
    default:
      return ""
  }
}

// "eb-flat" marks sections that only exist because MJML needs them; import unwraps them again.
// "eb-cont" marks the rest of a section MJML had to split (columns can't share a row); import merges it back.
const FLAT = "eb-flat"
const CONT = "eb-cont"
const classes = (el: Element) =>
  (el.getAttribute("css-class") ?? "").split(/\s+/)

export function toMjml({ settings: s, blocks }: EmailDoc): string {
  const body: string[] = []
  let run: Block[] = []
  const flush = () => {
    if (run.length) body.push(rows(run, s.width, { "css-class": FLAT }, 0, 24))
    run = []
  }
  for (const b of blocks) {
    if (b.type === "section" || b.type === "wrapper" || b.type === "hero") {
      flush()
      body.push(topMjml(b, s.width))
    } else if (b.type === "columns") {
      flush()
      body.push(
        tag(
          "mj-section",
          { "css-class": FLAT, padding: "8px 24px" },
          columnsMjml(b, s.width - 48)
        )
      )
    } else run.push(b)
  }
  flush()
  const fontName = (u: string) =>
    decodeURIComponent(/family=([^:&]+)/.exec(u)?.[1] ?? "Custom").replace(
      /\+/g,
      " "
    )
  const head = [
    s.subject.trim() && tag("mj-title", {}, escapeText(s.subject)),
    s.preview.trim() && tag("mj-preview", {}, escapeText(s.preview)),
    ...fontUrls(s).map((u) => tag("mj-font", { name: fontName(u), href: u })),
    tag("mj-breakpoint", { width: s.responsive ? px(s.breakpoint) : "1px" }),
    tag(
      "mj-attributes",
      {},
      tag("mj-all", { "font-family": FONTS.Helvetica }) +
        tag("mj-section", { "background-color": s.contentBg })
    ),
    s.css.trim() && `<mj-style>${s.css}</mj-style>`,
  ].filter(Boolean)
  return [
    `<mjml${attrs({ lang: s.lang, dir: s.dir })}>`,
    `  <mj-head>\n    ${head.join("\n    ")}\n  </mj-head>`,
    `  ${tag("mj-body", { "background-color": s.bg, width: px(s.width) }, `\n${body.join("\n")}\n  `)}`,
    "</mjml>",
    "",
  ].join("\n")
}

// --- Import helpers ---

type Obj = Record<string, unknown>
const hex = (v: string | null | undefined, fallback: string) => {
  const s = (v ?? "").trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  if (/^#[0-9a-f]{3}$/.test(s))
    return "#" + [...s.slice(1)].map((c) => c + c).join("")
  return fallback
}
const num = (v: string | null | undefined, fallback: number) => {
  const n = Number.parseFloat(v ?? "")
  return Number.isFinite(n) && n >= 0 ? n : fallback
}
const leaf = (type: BlockType, fields: Obj): Obj => ({ type, ...fields })
const container = (
  type: BlockType,
  children: Obj[],
  fields: Obj = {}
): Obj => ({
  type,
  ...fields,
  children,
})
const finish = (settings: Obj, blocks: Obj[]) =>
  parseDoc(
    JSON.stringify({ settings: { ...DEFAULT_SETTINGS, ...settings }, blocks })
  )
const ALIGNS = ["left", "center", "right"]
const align = (v: string | null, fallback = "left") =>
  v && ALIGNS.includes(v) ? v : fallback

const rich = (el: Element) => serializeRich(el, safeUrl)

// --- MJML import ---

function mjText(el: Element): Obj {
  const color = hex(el.getAttribute("color"), "#333333")
  const a = { color, align: align(el.getAttribute("align")) }
  const font = {
    fontSize: num(el.getAttribute("font-size"), 16),
  }
  const kids = [...el.children]
  const only =
    kids.length === 1 &&
    !el.textContent?.replace(kids[0].textContent ?? "", "").trim()
      ? kids[0]
      : null
  const name = only?.tagName.toLowerCase()
  if (only && (name === "h1" || name === "h2" || name === "h3")) {
    const type = { h1: "title", h2: "subtitle", h3: "heading" }[
      name
    ] as BlockType
    return leaf(type, {
      ...a,
      color: hex(el.getAttribute("color"), "#111111"),
      text: rich(only).replace(/\n/g, " "),
    })
  }
  if (only && (name === "ul" || name === "ol"))
    return leaf(name === "ul" ? "bulletList" : "numberedList", {
      color,
      ...font,
      items: [...only.querySelectorAll("li")].map(rich).join("\n"),
    })
  if (only && name === "blockquote")
    return leaf("quote", { color, ...font, body: rich(only) })
  if (only && name === "pre")
    return leaf("code", {
      color: hex(el.getAttribute("color"), DEFAULTS.code.color),
      bg: hex(el.getAttribute("container-background-color"), DEFAULTS.code.bg),
      body: only.textContent ?? "",
    })
  return leaf("text", { ...a, ...font, body: rich(el) })
}

const attr = (el: Element, k: string) => el.getAttribute(k)
const childrenOf = (el: Element, name: string) =>
  [...el.children].filter((c) => c.tagName.toLowerCase() === name)

function mjLeaf(el: Element): Obj | null {
  const name = el.tagName.toLowerCase()
  switch (name) {
    case "mj-text":
      return mjText(el)
    case "mj-button":
      return leaf("button", {
        text: el.textContent?.trim() ?? "",
        href: attr(el, "href") ?? "",
        bg: hex(attr(el, "background-color"), "#414141"),
        color: hex(attr(el, "color"), "#ffffff"),
        align: align(attr(el, "align"), "center"),
        radius: num(attr(el, "border-radius"), 3),
        fullWidth: attr(el, "width") === "100%",
      })
    case "mj-image":
      return leaf("image", {
        src: attr(el, "src") ?? "",
        alt: attr(el, "alt") ?? "",
        href: attr(el, "href") ?? "",
        align: align(attr(el, "align"), "center"),
      })
    case "mj-divider":
      return leaf("divider", {
        color: hex(attr(el, "border-color"), "#000000"),
        thickness: num(attr(el, "border-width"), 4),
      })
    case "mj-spacer":
      return leaf("spacer", { height: num(attr(el, "height"), 20) })
    case "mj-navbar":
      return leaf("navbar", {
        align: align(attr(el, "align"), "center"),
        links: childrenOf(el, "mj-navbar-link")
          .map((l) => `${l.textContent?.trim()} | ${attr(l, "href") ?? ""}`)
          .join("\n"),
      })
    case "mj-social":
      return leaf("social", {
        align: align(attr(el, "align"), "center"),
        socialMode: attr(el, "mode") === "vertical" ? "vertical" : "horizontal",
        iconSize: num(attr(el, "icon-size"), 20),
        networks: childrenOf(el, "mj-social-element")
          .map(
            (s) =>
              `${(attr(s, "name") ?? "web").replace(/-noshare$/, "")} | ${attr(s, "href") ?? ""}`
          )
          .join("\n"),
      })
    case "mj-accordion":
      return leaf("accordion", {
        panels: childrenOf(el, "mj-accordion-element")
          .map((e) => {
            const t =
              e.querySelector("mj-accordion-title")?.textContent?.trim() ?? ""
            const x =
              e.querySelector("mj-accordion-text")?.textContent?.trim() ?? ""
            return `${t} | ${x.replace(/\s*\n\s*/g, " ")}`
          })
          .join("\n"),
      })
    case "mj-carousel":
      return leaf("carousel", {
        images: childrenOf(el, "mj-carousel-image")
          .map((i) => attr(i, "src") ?? "")
          .join("\n"),
      })
    case "table": // mj-table, renamed before parsing so the HTML parser keeps its rows
      return leaf("table", {
        header: !!el.querySelector("tr:first-child th"),
        color: hex(attr(el, "color"), "#000000"),
        rows: [...el.querySelectorAll("tr")]
          .map((tr) =>
            [...tr.children]
              .map((c) => c.textContent?.trim().replace(/\|/g, "/"))
              .join(" | ")
          )
          .join("\n"),
      })
    case "mj-raw":
      return leaf("raw", { html: el.innerHTML.trim() })
    default:
      return el.outerHTML ? leaf("raw", { html: el.outerHTML }) : null
  }
}

const leaves = (el: Element) =>
  [...el.children].map(mjLeaf).filter((x): x is Obj => !!x)

function mjSection(el: Element, contentOnly = false): Obj[] {
  const cols = [...el.children]
    .flatMap((c) =>
      c.tagName.toLowerCase() === "mj-group" ? [...c.children] : [c]
    )
    .filter((c) => c.tagName.toLowerCase() === "mj-column")
  const grouped = !!childrenOf(el, "mj-group").length
  const content =
    cols.length > 1
      ? [
          container(
            "columns",
            cols.slice(0, 4).map((c) => container("column", leaves(c))),
            { stackOnMobile: !grouped }
          ),
        ]
      : cols.flatMap(leaves)
  if (contentOnly || classes(el).includes(FLAT)) return content
  return [
    container("section", content, {
      bg: hex(attr(el, "background-color"), "#ffffff"),
      bgImage: attr(el, "background-url") ?? "",
      padding: num(attr(el, "padding"), 20),
    }),
  ]
}

function tops(els: Element[]): Obj[] {
  const out: Obj[] = []
  for (const el of els) {
    const prev = out[out.length - 1]
    if (classes(el).includes(CONT) && prev?.type === "section")
      (prev.children as Obj[]).push(...mjSection(el, true))
    else out.push(...mjTop(el))
  }
  return out
}

function mjTop(el: Element): Obj[] {
  switch (el.tagName.toLowerCase()) {
    case "mj-section":
      return mjSection(el)
    case "mj-wrapper":
      return [
        container(
          "wrapper",
          tops([...el.children]).filter(
            (x) => x.type === "section" || x.type === "hero"
          ),
          {
            bg: hex(attr(el, "background-color"), "#ffffff"),
            padding: num(attr(el, "padding"), 20),
          }
        ),
      ]
    case "mj-hero":
      return [
        container("hero", leaves(el), {
          bg: hex(attr(el, "background-color"), "#ffffff"),
          bgImage: attr(el, "background-url") ?? "",
          height: num(attr(el, "height"), 0) || DEFAULTS.hero.height,
          padding: num(attr(el, "padding"), 0),
        }),
      ]
    case "mj-raw":
      return [leaf("raw", { html: el.innerHTML.trim() })]
    default:
      return []
  }
}

// Browser only.
export function fromMjml(src: string): EmailDoc | null {
  const html = src
    // Self-closing tags aren't a thing in HTML parsing; expand them.
    .replace(/<(mj-[\w-]+)([^>]*?)\/>/g, "<$1$2></$1>")
    // The HTML parser drops <tr> outside a <table>, so parse mj-table as one.
    .replace(/<mj-table\b/g, "<table")
    .replace(/<\/mj-table>/g, "</table>")
  const d = new DOMParser().parseFromString(html, "text/html")
  const root = d.querySelector("mjml")
  const body = d.querySelector("mj-body")
  if (!root || !body) return null
  const text = (sel: string) => d.querySelector(sel)?.textContent?.trim() ?? ""
  const bp = d.querySelector("mj-breakpoint")?.getAttribute("width")
  const settings: Obj = {
    subject: text("mj-title"),
    preview: text("mj-preview"),
    css: [...d.querySelectorAll("mj-style")]
      .map((s) => s.textContent)
      .join("\n")
      .trim(),
    fontUrls: [...d.querySelectorAll("mj-font")]
      .map((f) => f.getAttribute("href") ?? "")
      .join("\n"),
    bg: hex(attr(body, "background-color"), DEFAULT_SETTINGS.bg),
    contentBg: hex(
      d
        .querySelector("mj-attributes mj-section")
        ?.getAttribute("background-color"),
      DEFAULT_SETTINGS.contentBg
    ),
    width: num(attr(body, "width"), 600),
    lang: attr(root, "lang") ?? "en",
    dir: attr(root, "dir") === "rtl" ? "rtl" : "ltr",
    ...(bp &&
      (num(bp, 620) <= 1
        ? { responsive: false }
        : { breakpoint: num(bp, 620) })),
  }
  return finish(settings, tops([...body.children]))
}

// --- Markdown ---

const mdEscape = (t: string) => t.replace(/[\\*_[\]~`<>]/g, "\\$&")

function mdInline(s: string): string {
  const walk = (nodes: Inline[]): string =>
    nodes
      .map((n) => {
        if (typeof n === "string") return mdEscape(n)
        const inner = walk(n.children)
        switch (n.tag) {
          case "b":
            return `**${inner}**`
          case "i":
            return `*${inner}*`
          case "s":
            return `~~${inner}~~`
          case "u":
            return `<u>${inner}</u>`
          case "a":
            return n.href && safeUrl(n.href) ? `[${inner}](${n.href})` : inner
        }
      })
      .join("")
  return walk(parseInline(s))
}

function leafMd(b: Block): string {
  switch (b.type) {
    case "title":
    case "subtitle":
    case "heading":
      return `${"#".repeat({ title: 1, subtitle: 2, heading: 3 }[b.type])} ${mdInline(b.text)}`
    case "text":
      return mdInline(b.body)
    case "bulletList":
      return listItems(b.items)
        .map((i) => `- ${mdInline(i)}`)
        .join("\n")
    case "numberedList":
      return listItems(b.items)
        .map((it, i) => `${i + 1}. ${mdInline(it)}`)
        .join("\n")
    case "quote":
      return mdInline(b.body)
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n")
    case "code":
      return "```\n" + b.body + "\n```"
    case "button":
      return `[${mdEscape(b.text)}](${b.href}){button}`
    case "image":
      return b.href.trim()
        ? `[![${mdEscape(b.alt)}](${b.src})](${b.href})`
        : `![${mdEscape(b.alt)}](${b.src})`
    case "divider":
      return "---"
    case "navbar":
    case "social":
      return pairs(b.type === "navbar" ? b.links : b.networks)
        .map(([l, u]) => `[${mdEscape(l)}](${u})`)
        .join(" · ")
    case "accordion":
      return pairs(b.panels)
        .map(([t, x]) => `**${mdEscape(t)}**\n${mdEscape(x)}`)
        .join("\n\n")
    case "carousel":
      return lines(b.images)
        .map((u) => `![](${u})`)
        .join("\n\n")
    case "table": {
      const r = tableRows(b.rows).map(
        (cells) => `| ${cells.map(mdEscape).join(" | ")} |`
      )
      if (!r.length) return ""
      const sep = `|${" --- |".repeat(tableRows(b.rows)[0].length)}`
      return b.header ? [r[0], sep, ...r.slice(1)].join("\n") : r.join("\n")
    }
    case "raw":
      return b.html
    default:
      return ""
  }
}

export function toMarkdown({ settings: s, blocks }: EmailDoc): string {
  const front = [
    s.subject.trim() && `subject: ${s.subject.trim()}`,
    s.preview.trim() && `preheader: ${s.preview.trim()}`,
  ].filter(Boolean)
  const body = allBlocks(blocks)
    .filter((b) => !isContainer(b))
    .map(leafMd)
    .filter(Boolean)
    .join("\n\n")
  return (front.length ? `---\n${front.join("\n")}\n---\n\n` : "") + body + "\n"
}

const INLINE =
  /\\([\\*_[\]~`<>])|\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|<u>(.+?)<\/u>|\[([^\]]+)\]\(([^)\s]+)\)/g

// Markdown inline syntax to the stored rich-text subset.
function richFromMd(s: string): string {
  let out = ""
  let last = 0
  for (const m of s.matchAll(INLINE)) {
    out += escapeText(s.slice(last, m.index))
    last = m.index + m[0].length
    if (m[1]) out += escapeText(m[1])
    else if (m[2]) out += `<b>${richFromMd(m[2])}</b>`
    else if (m[3]) out += `<i>${richFromMd(m[3])}</i>`
    else if (m[4]) out += `<s>${richFromMd(m[4])}</s>`
    else if (m[5]) out += `<u>${richFromMd(m[5])}</u>`
    else {
      const href = safeUrl(m[7])
      out += href
        ? `<a href="${escapeAttr(href)}">${richFromMd(m[6])}</a>`
        : richFromMd(m[6])
    }
  }
  return out + escapeText(s.slice(last))
}
const unescapeMd = (s: string) => s.replace(/\\([\\*_[\]~`<>])/g, "$1")

const BLOCK_START =
  /^(#{1,3}\s|```|>|[-*+]\s|\d+[.)]\s|\||!\[|\[[^\]]+\]\([^)]+\)\{button\}\s*$|(-{3,}|\*{3,}|_{3,})\s*$)/

export function fromMarkdown(md: string): EmailDoc | null {
  const src = md.replace(/\r\n?/g, "\n").split("\n")
  const settings: Obj = {}
  let i = 0
  if (src[0]?.trim() === "---") {
    const end = src.indexOf("---", 1)
    if (end > 0) {
      for (const l of src.slice(1, end)) {
        const m = /^(\w+):\s*(.*)$/.exec(l)
        if (m?.[1] === "subject") settings.subject = m[2]
        if (m?.[1] === "preheader" || m?.[1] === "preview")
          settings.preview = m[2]
      }
      i = end + 1
    }
  }
  const blocks: Obj[] = []
  const take = (re: RegExp) => {
    const out: string[] = []
    while (i < src.length && re.test(src[i])) out.push(src[i++])
    return out
  }
  while (i < src.length) {
    const line = src[i]
    let m: RegExpExecArray | null
    if (!line.trim()) {
      i++
    } else if (line.startsWith("```")) {
      const end = src.indexOf("```", i + 1)
      const stop = end < 0 ? src.length : end
      blocks.push(leaf("code", { body: src.slice(i + 1, stop).join("\n") }))
      i = stop + 1
    } else if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) {
      const type = (["title", "subtitle", "heading"] as const)[m[1].length - 1]
      blocks.push(leaf(type, { text: richFromMd(m[2].trim()) }))
      i++
    } else if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(leaf("divider", {}))
      i++
    } else if (
      (m = /^(?:\[)?!\[([^\]]*)\]\(([^)\s]+)\)(?:\]\(([^)\s]+)\))?\s*$/.exec(
        line
      ))
    ) {
      blocks.push(
        leaf("image", { alt: unescapeMd(m[1]), src: m[2], href: m[3] ?? "" })
      )
      i++
    } else if ((m = /^\[([^\]]+)\]\(([^)\s]+)\)\{button\}\s*$/.exec(line))) {
      blocks.push(leaf("button", { text: unescapeMd(m[1]), href: m[2] }))
      i++
    } else if (line.startsWith(">")) {
      const body = take(/^>/).map((l) => richFromMd(l.replace(/^>\s?/, "")))
      blocks.push(leaf("quote", { body: body.join("\n") }))
    } else if (/^[-*+]\s/.test(line)) {
      const items = take(/^[-*+]\s/).map((l) =>
        richFromMd(l.replace(/^[-*+]\s+/, ""))
      )
      blocks.push(leaf("bulletList", { items: items.join("\n") }))
    } else if (/^\d+[.)]\s/.test(line)) {
      const items = take(/^\d+[.)]\s/).map((l) =>
        richFromMd(l.replace(/^\d+[.)]\s+/, ""))
      )
      blocks.push(leaf("numberedList", { items: items.join("\n") }))
    } else if (line.startsWith("|")) {
      const rowsMd = take(/^\|/)
      const isSep = (l: string) => /^\|?[\s:|-]+\|?$/.test(l) && l.includes("-")
      const header = rowsMd.length > 1 && isSep(rowsMd[1])
      const cells = rowsMd
        .filter((l) => !isSep(l))
        .map((l) =>
          l
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((c) => unescapeMd(c.trim()))
            .join(" | ")
        )
      blocks.push(leaf("table", { rows: cells.join("\n"), header }))
    } else if (/^<(?!u>)[a-z]/i.test(line)) {
      const html: string[] = []
      while (i < src.length && src[i].trim()) html.push(src[i++])
      blocks.push(leaf("raw", { html: html.join("\n") }))
    } else {
      const para: string[] = []
      while (
        i < src.length &&
        src[i].trim() &&
        (!para.length || !BLOCK_START.test(src[i]))
      )
        para.push(src[i++].replace(/( {2,}|\\)$/, ""))
      blocks.push(leaf("text", { body: para.map(richFromMd).join("\n") }))
    }
  }
  return finish(settings, blocks)
}

// --- HTML import (beta): pulls content blocks out of any HTML, ignoring layout tables. ---

const SKIP = new Set([
  "head",
  "style",
  "script",
  "title",
  "meta",
  "link",
  "noscript",
])

// Browser only.
export function fromHtml(html: string): EmailDoc | null {
  const d = new DOMParser().parseFromString(html, "text/html")
  const out: Obj[] = []
  const visit = (el: Element) => {
    for (const n of el.childNodes) {
      if (n.nodeType === 3) {
        const t = n.textContent?.trim()
        if (t) out.push(leaf("text", { body: escapeText(t) }))
        continue
      }
      if (n.nodeType !== 1) continue
      const e = n as Element
      const name = e.tagName.toLowerCase()
      if (
        SKIP.has(name) ||
        /display:\s*none/i.test(e.getAttribute("style") ?? "")
      )
        continue
      const text = e.textContent?.trim() ?? ""
      if (/^h[1-6]$/.test(name)) {
        if (text)
          out.push(
            leaf(
              name === "h1" ? "title" : name === "h2" ? "subtitle" : "heading",
              { text: rich(e).replace(/\n/g, " ") }
            )
          )
      } else if (name === "p") {
        if (text) out.push(leaf("text", { body: rich(e) }))
        else
          e.querySelectorAll("img").forEach((img) =>
            visit(img.parentElement ?? img)
          )
      } else if (name === "ul" || name === "ol") {
        out.push(
          leaf(name === "ul" ? "bulletList" : "numberedList", {
            items: [...e.querySelectorAll("li")].map(rich).join("\n"),
          })
        )
      } else if (name === "blockquote") {
        out.push(leaf("quote", { body: rich(e) }))
      } else if (name === "pre") {
        out.push(leaf("code", { body: e.textContent ?? "" }))
      } else if (name === "hr") {
        out.push(leaf("divider", {}))
      } else if (name === "img") {
        out.push(
          leaf("image", {
            src: e.getAttribute("src") ?? "",
            alt: e.getAttribute("alt") ?? "",
            href: e.closest("a")?.getAttribute("href") ?? "",
          })
        )
      } else if (name === "a" && !e.querySelector("img")) {
        if (text)
          out.push(leaf("button", { text, href: e.getAttribute("href") ?? "" }))
      } else visit(e)
    }
  }
  visit(d.body)
  return finish({ subject: d.title.trim() }, out)
}
