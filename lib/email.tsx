import {
  Fragment,
  isValidElement,
  type CSSProperties,
  type ReactNode,
} from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "react-email"
import { plainText, renderInline } from "./rich"
import {
  FONTS,
  isContainer,
  pairs,
  type Block,
  type EmailDoc,
  type Font,
  type Settings,
} from "./model"

export * from "./model"

// --- HTML rendering. ---

export const safeUrl = (u: string) =>
  /^(https?:|mailto:)/i.test(u.trim()) ? u.trim() : undefined
// For CSS url(): http(s) only, with the characters that could end url("...") percent-encoded.
const cssUrl = (u: string) => {
  const s = safeUrl(u)
  return s && /^https?:/i.test(s)
    ? `url("${s.replace(/["'()\\\s]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"))}")`
    : undefined
}
// `background` is the attribute fallback for clients that drop CSS backgrounds.
const bgAttrs = (bg: string, img = "") => ({
  bgcolor: bg,
  ...(cssUrl(img) && { background: safeUrl(img) }),
})
const bgStyle = (img: string) =>
  cssUrl(img)
    ? {
        backgroundImage: cssUrl(img),
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {}

export const allBlocks = (blocks: Block[]): Block[] =>
  blocks.flatMap((b) => [b, ...(isContainer(b) ? allBlocks(b.children) : [])])

const MONO = "Menlo, Consolas, monospace"
const HEADING_TAG = { title: "h1", subtitle: "h2", heading: "h3" } as const
const fontOf = (b: Font) => ({
  fontFamily: FONTS[b.fontFamily],
  fontSize: b.fontSize,
  fontWeight: b.fontWeight,
  lineHeight: b.lineHeight,
})
const mobileCss = (bp: number) =>
  `@media (max-width:${bp}px){.col{display:block!important;width:100%!important;padding:0!important}}`

// Carousel: the CSS radio-button technique MJML uses. Clients without :checked support (Gmail, Outlook)
// show the first image only; the thumbnails stay hidden there because only a checked input reveals them.
const MAX_SLIDES = 10
// Hides from Outlook desktop, which ignores display:none. Not in React's CSS types.
const MSO_HIDE = { msoHide: "all" } as CSSProperties
const CAROUSEL_CSS =
  ".crsl input:checked~.crsl-thumbs{display:block!important;max-height:none!important}" +
  Array.from(
    { length: MAX_SLIDES },
    (_, i) =>
      `.crsl-r${i + 1}:checked~.crsl-imgs .crsl-i{display:none!important}` +
      `.crsl-r${i + 1}:checked~.crsl-imgs .crsl-i${i + 1}{display:block!important;max-height:none!important}`
  ).join("")

// Icons MJML's mj-social uses (white glyphs on a colored background).
export const ICONS = "https://www.mailjet.com/images/theme/v1/icons/ico-social/"
export const SOCIAL: Record<string, { icon: string; bg: string }> = {
  facebook: { icon: "facebook", bg: "#3b5998" },
  twitter: { icon: "twitter", bg: "#55acee" },
  x: { icon: "twitter-x", bg: "#000000" },
  linkedin: { icon: "linkedin", bg: "#0077b5" },
  instagram: { icon: "instagram", bg: "#3f729b" },
  youtube: { icon: "youtube", bg: "#eb3323" },
  tiktok: { icon: "tiktok", bg: "#000000" },
  github: { icon: "github", bg: "#000000" },
  pinterest: { icon: "pinterest", bg: "#bd081c" },
  snapchat: { icon: "snapchat", bg: "#fffa54" },
  medium: { icon: "medium", bg: "#000000" },
  dribbble: { icon: "dribbble", bg: "#d95988" },
  vimeo: { icon: "vimeo", bg: "#53b4e7" },
  web: { icon: "web", bg: "#4bade9" },
}
export const socialOf = (name: string) =>
  SOCIAL[name.toLowerCase()] ?? SOCIAL.web

export const listItems = (s: string) =>
  s.split("\n").filter((l) => plainText(l).trim())
export const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
export const tableRows = (s: string) =>
  lines(s).map((l) => l.split("|").map((c) => c.trim()))
const rich = (s: string, color?: string) => renderInline(s, safeUrl, color)

// Preview-only attributes (edit mode): blocks become selectable and their text editable in place.
// Exported HTML and React source are rendered with edit=false, so they never contain these.
// Rich fields allow inline formatting; the rest (button labels, code) stay plain text.
// Canvas mode also makes blocks draggable (columns are fixed; locked blocks can't move).
const blockAttrs = (ctx: Ctx, b: Block) =>
  ctx.edit
    ? {
        "data-block": b.id,
        ...(b.locked && { "data-locked": "" }),
        ...(isContainer(b) && { "data-container": "" }),
        ...(ctx.canvas &&
          b.type !== "column" &&
          !ctx.locked &&
          !b.locked && { draggable: true }),
      }
    : {}
const fieldAttrs = (edit: boolean, field: string, isRich = false) =>
  edit
    ? {
        "data-field": field,
        ...(isRich && { "data-rich": "" }),
        contentEditable: isRich ? true : ("plaintext-only" as const),
        suppressContentEditableWarning: true,
      }
    : {}
// Thin, neutral scrollbar inside preview frames (display only, never exported).
export const SCROLLBAR_CSS = `html{scrollbar-width:thin;scrollbar-color:rgb(128 128 128/.5) transparent}`
const EDIT_CSS = `
[data-block]:hover:not(:has([data-block]:hover)){outline:1px dashed #60a5fa;outline-offset:-1px}
[data-locked]{outline:1px dashed #f59e0b;outline-offset:-1px}
[data-selected]{outline:2px solid #3b82f6 !important;outline-offset:-2px}
[data-field]{cursor:text}
[data-field]:focus{outline:none}
[data-field]:empty{min-height:1em;min-width:2em}
[data-drop-before]{box-shadow:inset 0 2px 0 #3b82f6}
[data-drop-after]{box-shadow:inset 0 -2px 0 #3b82f6}
[data-drop-inside]{box-shadow:inset 0 0 0 2px #3b82f6}
${SCROLLBAR_CSS}`
// Canvas mode: every block outlined, so the structure is visible.
const CANVAS_CSS = `[data-block]{outline:1px dashed #d4d4d8;outline-offset:-1px}[draggable=true]{cursor:grab}`

// edit: preview attributes on; text: text editable in place (Edit mode);
// canvas: blocks draggable (Canvas mode); locked: inside a locked block.
type Ctx = { edit: boolean; text: boolean; canvas: boolean; locked: boolean }
export type EditView = "canvas" | "edit"

// Every block is a React Email <Section> (a centered, full-width presentation table), so the
// structure matches what React Email users write by hand and what the React export imports.
// `outer` is the width this block's cell spans; `padX` is its horizontal padding.
function BlockRow({
  b,
  outer,
  padX,
  ctx,
}: {
  b: Block
  outer: number
  padX: number
  ctx: Ctx
}) {
  const attrs = blockAttrs(ctx, b)
  const c = { ...ctx, locked: ctx.locked || !!b.locked }
  if (b.type === "column") return null
  if (b.type === "spacer")
    return (
      <Section
        {...attrs}
        style={{ height: b.height, lineHeight: `${b.height}px`, fontSize: 0 }}
      >
        &nbsp;
      </Section>
    )
  if (b.type === "section")
    return (
      <Section
        {...attrs}
        {...bgAttrs(b.bg, b.bgImage)}
        style={{
          backgroundColor: b.bg,
          ...bgStyle(b.bgImage),
          padding: b.padding,
        }}
      >
        <Blocks
          blocks={b.children}
          outer={outer - 2 * b.padding}
          padX={0}
          ctx={c}
        />
      </Section>
    )
  if (b.type === "wrapper")
    return (
      <Section
        {...attrs}
        {...bgAttrs(b.bg)}
        style={{
          backgroundColor: b.bg,
          border: `1px solid ${b.borderColor}`,
          borderRadius: b.radius,
          padding: b.padding,
        }}
      >
        <Blocks
          blocks={b.children}
          outer={outer - 2 * b.padding - 2}
          padX={0}
          ctx={c}
        />
      </Section>
    )
  // ponytail: CSS background + `background` attribute only; no Outlook VML, add it if Outlook desktop backgrounds matter.
  if (b.type === "hero")
    return (
      <Section
        {...attrs}
        {...bgAttrs(b.bg, b.bgImage)}
        style={{ backgroundColor: b.bg, ...bgStyle(b.bgImage) }}
      >
        <Row>
          <Column
            valign={b.vAlign}
            style={{
              height: b.height,
              padding: b.padding,
              verticalAlign: b.vAlign,
            }}
          >
            <Blocks
              blocks={b.children}
              outer={outer - 2 * b.padding}
              padX={0}
              ctx={c}
            />
          </Column>
        </Row>
      </Section>
    )
  const inner = outer - 2 * padX
  const spacing = "spacing" in b ? b.spacing : 8
  return (
    <Section
      {...attrs}
      style={{
        padding: `${spacing}px ${padX}px`,
        ...("align" in b && { textAlign: b.align }),
      }}
    >
      {b.type === "columns" ? (
        <ColumnsView b={b} inner={inner} ctx={c} />
      ) : (
        <BlockView b={b} inner={inner} ctx={c} />
      )}
    </Section>
  )
}

function Blocks({
  blocks,
  outer,
  padX,
  ctx,
}: {
  blocks: Block[]
  outer: number
  padX: number
  ctx: Ctx
}) {
  return (
    <>
      {blocks.map((b) => (
        <BlockRow key={b.id} b={b} outer={outer} padX={padX} ctx={ctx} />
      ))}
    </>
  )
}

function ColumnsView({
  b,
  inner,
  ctx,
}: {
  b: Extract<Block, { type: "columns" }>
  inner: number
  ctx: Ctx
}) {
  const n = b.children.length
  const w = Math.floor((inner - b.gap * (n - 1)) / n)
  return (
    <Row>
      {b.children.map((c, i) => (
        <Column
          key={c.id}
          {...blockAttrs(ctx, c)}
          className={b.stackOnMobile ? "col" : undefined}
          width={`${Math.floor(100 / n)}%`}
          valign="top"
          style={{
            paddingLeft: i ? b.gap / 2 : 0,
            paddingRight: i < n - 1 ? b.gap / 2 : 0,
          }}
        >
          <Blocks
            blocks={isContainer(c) ? c.children : []}
            outer={w}
            padX={0}
            ctx={{ ...ctx, locked: ctx.locked || !!c.locked }}
          />
        </Column>
      ))}
    </Row>
  )
}

type Leaf = Exclude<Block, { children: Block[] } | { type: "spacer" }>

function BlockView({ b, inner, ctx }: { b: Leaf; inner: number; ctx: Ctx }) {
  const edit = ctx.text && !ctx.locked
  switch (b.type) {
    case "title":
    case "subtitle":
    case "heading":
      return (
        <Heading
          as={HEADING_TAG[b.type]}
          {...fieldAttrs(edit, "text", true)}
          style={{
            margin: 0,
            color: b.color,
            ...fontOf(b),
            textAlign: b.align,
          }}
        >
          {rich(b.text, b.color)}
        </Heading>
      )
    case "text":
      return (
        <Text
          {...fieldAttrs(edit, "body", true)}
          style={{
            margin: 0,
            color: b.color,
            ...fontOf(b),
            textAlign: b.align,
          }}
        >
          {rich(b.body, b.color)}
        </Text>
      )
    case "bulletList":
    case "numberedList": {
      const L = b.type === "bulletList" ? "ul" : "ol"
      return (
        <L
          {...fieldAttrs(edit, "items", true)}
          style={{ margin: 0, color: b.color, ...fontOf(b), paddingLeft: 24 }}
        >
          {listItems(b.items).map((item, i) => (
            <li key={i}>{rich(item, b.color)}</li>
          ))}
        </L>
      )
    }
    case "quote":
      return (
        <Section
          style={{ borderLeft: `4px solid ${b.borderColor}`, paddingLeft: 16 }}
        >
          <Text
            {...fieldAttrs(edit, "body", true)}
            style={{
              margin: 0,
              color: b.color,
              ...fontOf(b),
              fontStyle: "italic",
            }}
          >
            {rich(b.body, b.color)}
          </Text>
        </Section>
      )
    case "code":
      // React Email's <CodeBlock> needs a Prism language and theme; this block is
      // language-agnostic, so it stays a plain <pre> on a colored section.
      return (
        <Section
          {...{ bgcolor: b.bg }}
          style={{ backgroundColor: b.bg, borderRadius: 6, padding: 16 }}
        >
          <pre
            {...fieldAttrs(edit, "body")}
            style={{
              margin: 0,
              fontFamily: MONO,
              fontSize: 14,
              lineHeight: 1.5,
              color: b.color,
              whiteSpace: "pre-wrap",
            }}
          >
            {b.body}
          </pre>
        </Section>
      )
    case "image": {
      const pct = Math.max(1, Math.min(100, b.size))
      const img = (
        <Img
          src={safeUrl(b.src)}
          alt={b.alt}
          width={Math.round((inner * pct) / 100)}
          style={{
            width: `${pct}%`,
            height: "auto",
            borderRadius: b.radius || undefined,
            margin:
              b.align === "center"
                ? "0 auto"
                : b.align === "right"
                  ? "0 0 0 auto"
                  : undefined,
          }}
        />
      )
      const href = safeUrl(b.href)
      return href ? <Link href={href}>{img}</Link> : img
    }
    case "button":
      // <Button> adds the Outlook-only markup that makes its whole padded area clickable.
      return (
        <Button
          href={safeUrl(b.href)}
          style={{
            backgroundColor: b.bg,
            color: b.color,
            padding: "12px 24px",
            borderRadius: b.radius,
            ...fontOf(b),
            ...(b.fullWidth && { display: "block", textAlign: "center" }),
          }}
        >
          {edit ? <span {...fieldAttrs(edit, "text")}>{b.text}</span> : b.text}
        </Button>
      )
    case "divider":
      return (
        <Hr
          style={{ borderTop: `${b.thickness}px solid ${b.color}`, margin: 0 }}
        />
      )
    case "navbar":
      return (
        <Text style={{ margin: 0, ...fontOf(b), textAlign: b.align }}>
          {pairs(b.links).map(([label, url], i) => (
            <Link
              key={i}
              href={safeUrl(url)}
              style={{
                color: b.color,
                textDecoration: "none",
                display: "inline-block",
                padding: "0 12px",
              }}
            >
              {label}
            </Link>
          ))}
        </Text>
      )
    case "social":
      return (
        <Text style={{ margin: 0, textAlign: b.align, lineHeight: 0 }}>
          {pairs(b.networks).map(([name, url], i) => {
            const net = socialOf(name)
            return (
              <a
                key={i}
                href={safeUrl(url)}
                style={{
                  display:
                    b.socialMode === "vertical" ? "block" : "inline-block",
                  padding: 4,
                }}
              >
                <Img
                  src={`${ICONS}${net.icon}.png`}
                  alt={name}
                  width={b.iconSize}
                  height={b.iconSize}
                  style={{
                    display: "inline-block",
                    backgroundColor: net.bg,
                    borderRadius: 4,
                  }}
                />
              </a>
            )
          })}
        </Text>
      )
    case "accordion":
      // <details> opens and closes where supported; elsewhere every panel shows open.
      return (
        <>
          {pairs(b.panels).map(([title, body], i) => (
            <details
              key={i}
              style={{
                ...fontOf(b),
                color: b.color,
                border: `1px solid ${b.borderColor}`,
                borderTop: i ? "none" : undefined,
              }}
            >
              <summary
                style={{
                  padding: "12px 16px",
                  backgroundColor: b.bg,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {title}
              </summary>
              <div style={{ padding: "12px 16px" }}>{body}</div>
            </details>
          ))}
        </>
      )
    case "carousel": {
      const imgs = lines(b.images).slice(0, MAX_SLIDES)
      const name = `crsl-${b.id}`
      const multi = imgs.length > 1
      const thumbW = Math.floor(inner / Math.max(imgs.length, 4)) - 8
      return (
        <div className="crsl">
          {multi &&
            imgs.map((_, i) => (
              <input
                key={i}
                type="radio"
                name={name}
                id={`${name}-${i + 1}`}
                className={`crsl-r${i + 1}`}
                defaultChecked={i === 0}
                style={{ display: "none" }}
              />
            ))}
          <div className="crsl-imgs">
            {imgs.map((src, i) => (
              <div
                key={i}
                className={`crsl-i crsl-i${i + 1}`}
                style={
                  i
                    ? {
                        display: "none",
                        maxHeight: 0,
                        overflow: "hidden",
                        ...MSO_HIDE,
                      }
                    : undefined
                }
              >
                <Img
                  src={safeUrl(src)}
                  alt=""
                  width={inner}
                  style={{
                    width: "100%",
                    height: "auto",
                    borderRadius: b.radius,
                  }}
                />
              </div>
            ))}
          </div>
          {multi && (
            <div
              className="crsl-thumbs"
              style={{
                display: "none",
                maxHeight: 0,
                overflow: "hidden",
                ...MSO_HIDE,
                textAlign: "center",
                paddingTop: 8,
              }}
            >
              {imgs.map((src, i) => (
                <label
                  key={i}
                  htmlFor={`${name}-${i + 1}`}
                  style={{
                    display: "inline-block",
                    width: thumbW,
                    margin: 4,
                    cursor: "pointer",
                  }}
                >
                  <Img
                    src={safeUrl(src)}
                    alt={`Slide ${i + 1}`}
                    width={thumbW}
                    style={{ width: "100%", height: "auto", borderRadius: 4 }}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      )
    }
    case "table": {
      const cell = {
        border: `1px solid ${b.borderColor}`,
        padding: b.cellPadding,
        textAlign: "left" as const,
      }
      return (
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ borderCollapse: "collapse", color: b.color, ...fontOf(b) }}
        >
          <tbody>
            {tableRows(b.rows).map((r, i) => (
              <tr key={i}>
                {r.map((c, j) =>
                  b.header && i === 0 ? (
                    <th
                      key={j}
                      style={{
                        ...cell,
                        backgroundColor: "#f4f4f5",
                        fontWeight: 600,
                      }}
                    >
                      {c}
                    </th>
                  ) : (
                    <td key={j} style={cell}>
                      {c}
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )
    }
    case "raw":
      // Inserted as-is: it's the author's own markup. The preview iframe can't run scripts.
      return <div dangerouslySetInnerHTML={{ __html: b.html }} />
  }
}

// Indents HTML for reading by breaking only between adjacent tags ("><").
// Text can't contain a raw "<" (it's escaped), so text is never split.
// Display only: the added whitespace isn't safe inside e.g. <a><img/></a>, so export toHtml() as-is.
export function formatHtml(html: string) {
  let depth = 0
  return html
    .split(/(?<=>)(?=<)/)
    .map((chunk) => {
      const closing = chunk.startsWith("</")
      if (closing) depth = Math.max(0, depth - 1)
      const line = "  ".repeat(depth) + chunk
      const opens =
        !closing &&
        !chunk.startsWith("<!") &&
        !chunk.endsWith("/>") &&
        !/<\/[^>]+>$/.test(chunk)
      if (opens) depth++
      return line
    })
    .join("\n")
}

// The doctype React Email's render() uses, so toHtml() and the React export produce the same document.
const DOCTYPE =
  '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">'

// React 19 adds <link rel="preload"> tags for images; they're useless in email, and
// React Email's render() strips them the same way.
const renderDocument = (doc: EmailDoc, view: EditView | null) =>
  DOCTYPE +
  renderToStaticMarkup(emailElement(doc, view)).replace(
    /<link rel="preload" as="image"[^>]*\/>/g,
    ""
  )

export const toHtml = (doc: EmailDoc) => renderDocument(doc, null)

// The preview's markup: same email plus selection/edit attributes. Never export this.
export const toEditableHtml = (doc: EmailDoc, view: EditView = "edit") =>
  renderDocument(doc, view)

// --- React source. Serializes the same element tree toHtml renders, so the two can't drift. ---
// React Email components are printed by name (and imported); our own helper components are inlined.

const REACT_EMAIL = new Map<unknown, string>([
  [Html, "Html"],
  [Head, "Head"],
  [Body, "Body"],
  [Preview, "Preview"],
  [Container, "Container"],
  [Section, "Section"],
  [Row, "Row"],
  [Column, "Column"],
  [Heading, "Heading"],
  [Text, "Text"],
  [Button, "Button"],
  [Img, "Img"],
  [Hr, "Hr"],
  [Link, "Link"],
])

const IDENT = /^[A-Za-z_$][\w$]*$/
const jsString = (v: unknown) => JSON.stringify(v)
const jsObject = (o: object): string =>
  `{ ${Object.entries(o)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${IDENT.test(k) ? k : jsString(k)}: ${jsString(v)}`)
    .join(", ")} }`

function jsxAttr(name: string, v: unknown) {
  // React passes bgcolor through but its types don't know it, so spread it.
  if (name === "bgcolor" || name === "background")
    return `{...{ ${name}: ${jsString(v)} }}`
  if (typeof v === "string")
    return /["\\&{}\n]/.test(v) ? `${name}={${jsString(v)}}` : `${name}="${v}"`
  if (typeof v === "object" && v) return `${name}={${jsObject(v)}}`
  return `${name}={${jsString(v)}}`
}

const jsxText = (t: string) =>
  /^[^{}<>&\n]+$/.test(t) && t.trim() === t ? t : `{${jsString(t)}}`

function jsx(node: ReactNode, depth: number, used: Set<string>): string[] {
  const pad = "  ".repeat(depth)
  if (node == null || typeof node === "boolean" || node === "") return []
  if (typeof node === "string" || typeof node === "number")
    return [pad + jsxText(String(node))]
  if (Array.isArray(node)) return node.flatMap((n) => jsx(n, depth, used))
  if (!isValidElement<Record<string, unknown>>(node)) return []
  const { type, props } = node
  const children = props.children as ReactNode
  if (type === Fragment) return jsx(children, depth, used)
  const component = REACT_EMAIL.get(type)
  // Our own components are pure functions without hooks, so they can be inlined by calling them.
  if (!component && typeof type === "function")
    return jsx((type as (p: object) => ReactNode)(props), depth, used)
  if (component) used.add(component)
  const tag = component ?? String(type)
  const attrs = Object.entries(props)
    .filter(([k, v]) => k !== "children" && v !== undefined)
    .map(([k, v]) => jsxAttr(k, v))
  const kids = jsx(children, depth + 1, used)
  const close = kids.length ? ">" : " />"
  const oneLine = `${pad}<${tag}${attrs.map((a) => " " + a).join("")}${close}`
  const head =
    oneLine.length <= 80 || attrs.length < 2
      ? [oneLine]
      : [
          `${pad}<${tag}`,
          ...attrs.map((a) => `${pad}  ${a}`),
          `${pad}${close.trim()}`,
        ]
  return kids.length ? [...head, ...kids, `${pad}</${tag}>`] : head
}

export function toReact(doc: EmailDoc) {
  const used = new Set<string>()
  const body = jsx(emailElement(doc, null), 2, used)
  const names = [...used].sort().join(", ")
  return [
    `import { ${names}, render } from "react-email"`,
    "",
    "export default function Email() {",
    "  return (",
    ...body,
    "  )",
    "}",
    "",
    "// The HTML to send:",
    "export const renderEmail = () => render(<Email />)",
    "",
  ].join("\n")
}

// --- Plain text alternative (the text/plain part of a multipart email). ---

function textOf(b: Block): string {
  switch (b.type) {
    case "title":
    case "subtitle":
    case "heading":
      return plainText(b.text)
    case "text":
      return plainText(b.body)
    case "code":
      return b.body
    case "bulletList":
      return listItems(b.items)
        .map((i) => `- ${plainText(i)}`)
        .join("\n")
    case "numberedList":
      return listItems(b.items)
        .map((item, i) => `${i + 1}. ${plainText(item)}`)
        .join("\n")
    case "quote":
      return plainText(b.body)
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n")
    case "button":
    case "image": {
      const label = b.type === "button" ? b.text : b.alt
      const url = safeUrl(b.href)
      return url ? (label ? `${label}: ${url}` : url) : label
    }
    case "navbar":
    case "social":
      return pairs(b.type === "navbar" ? b.links : b.networks)
        .map(([label, url]) => {
          const safe = safeUrl(url)
          return safe ? `${label}: ${safe}` : label
        })
        .join("\n")
    case "accordion":
      return pairs(b.panels)
        .map(([t, body]) => `${t}\n${body}`)
        .join("\n\n")
    case "table":
      return tableRows(b.rows)
        .map((r) => r.join(" | "))
        .join("\n")
    case "raw":
      // ponytail: crude tag strip, fine for short snippets; use a real HTML-to-text if raw blocks get big.
      return b.html
        .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    case "divider":
      return "---"
    case "spacer":
    case "carousel":
      return ""
    case "section":
    case "wrapper":
    case "hero":
    case "columns":
    case "column":
      return joinText(b.children)
  }
}
const joinText = (blocks: Block[]) =>
  blocks.map(textOf).filter(Boolean).join("\n\n")
export const toText = (doc: EmailDoc) => joinText(doc.blocks) + "\n"

export const fontUrls = (s: Settings) =>
  lines(s.fontUrls).filter((u) => /^https:/i.test(safeUrl(u) ?? ""))

function emailElement(
  { settings: s, blocks }: EmailDoc,
  view: EditView | null
) {
  const edit = view !== null
  const css = [
    s.responsive && mobileCss(s.breakpoint),
    allBlocks(blocks).some((b) => b.type === "carousel") && CAROUSEL_CSS,
    s.css.trim(),
  ]
    .filter(Boolean)
    .join("")
  return (
    <Html lang={s.lang || "en"} dir={s.dir}>
      <Head>
        <meta
          name="viewport"
          content={
            s.responsive
              ? "width=device-width, initial-scale=1"
              : `width=${s.width}`
          }
        />
        {s.subject.trim() && <title>{s.subject}</title>}
        {fontUrls(s).map((u) => (
          <link key={u} rel="stylesheet" href={u} />
        ))}
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
        {edit && (
          <style
            dangerouslySetInnerHTML={{
              __html: (view === "canvas" ? CANVAS_CSS : "") + EDIT_CSS,
            }}
          />
        )}
      </Head>
      <Body
        style={{
          backgroundColor: s.bg,
          margin: 0,
          padding: "24px 12px",
          fontFamily: FONTS.Helvetica,
        }}
      >
        {/* useTitleTag off: <Preview> would add a second <title> after the subject's. */}
        {s.preview.trim() && <Preview useTitleTag={false}>{s.preview}</Preview>}
        {/* The width attribute holds the layout in Outlook, which ignores max-width. */}
        <Container
          width={s.width}
          style={{
            width: "100%",
            maxWidth: s.width,
            backgroundColor: s.contentBg,
          }}
        >
          <Blocks
            blocks={blocks}
            outer={s.width}
            padX={24}
            ctx={{
              edit,
              text: view === "edit",
              canvas: view === "canvas",
              locked: false,
            }}
          />
        </Container>
      </Body>
    </Html>
  )
}
