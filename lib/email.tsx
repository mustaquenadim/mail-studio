import { Fragment, isValidElement, type ReactNode } from "react"
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

type Align = "left" | "center" | "right"
const LEFT = "left" as Align
const CENTER = "center" as Align

// Default fields per block type. Doubles as the schema: field kinds are inferred from these.
export const DEFAULTS = {
  text: { body: "Write your message here.", color: "#333333", align: LEFT },
  title: { text: "Title", color: "#111111", align: LEFT },
  subtitle: { text: "Subtitle", color: "#111111", align: LEFT },
  heading: { text: "Heading", color: "#111111", align: LEFT },
  bulletList: {
    items: "First item\nSecond item\nThird item",
    color: "#333333",
  },
  numberedList: {
    items: "First item\nSecond item\nThird item",
    color: "#333333",
  },
  quote: {
    body: "A memorable quote.",
    color: "#555555",
    borderColor: "#d4d4d8",
  },
  code: { body: 'const greeting = "Hello"', color: "#e4e4e7", bg: "#18181b" },
  button: {
    text: "Call to action",
    href: "https://example.com",
    bg: "#2563eb",
    color: "#ffffff",
    align: CENTER,
  },
  divider: { color: "#e5e5e5" },
  section: { bg: "#ffffff", padding: 24 },
  columns: { gap: 16 },
  column: {},
  image: { src: "https://placehold.co/600x300/png", alt: "", href: "" },
  spacer: { height: 24 },
}

const CONTAINERS = ["section", "columns", "column"] as const
type ContainerType = (typeof CONTAINERS)[number]
type Defaults = typeof DEFAULTS

export type BlockType = keyof Defaults
type LeafType = Exclude<BlockType, ContainerType>
type LeafBlock = {
  [T in LeafType]: { id: string; type: T } & Defaults[T]
}[LeafType]
// Interfaces (not mapped types) so the recursive `children: Block[]` type-checks.
interface Container<T extends ContainerType> {
  id: string
  type: T
  children: Block[]
}
type SectionFields = Defaults["section"]
type ColumnsFields = Defaults["columns"]
interface SectionBlock extends Container<"section">, SectionFields {}
interface ColumnsBlock extends Container<"columns">, ColumnsFields {}
type ColumnBlock = Container<"column">
export type Block = LeafBlock | SectionBlock | ColumnsBlock | ColumnBlock
export type Settings = {
  preview: string
  bg: string
  contentBg: string
  width: number
}
export type EmailDoc = { settings: Settings; blocks: Block[] }

export const DEFAULT_SETTINGS: Settings = {
  // The preheader: the line inbox lists show after the subject. Hidden in the email body.
  preview: "",
  bg: "#f4f4f5",
  contentBg: "#ffffff",
  width: 600,
}

const isContainerType = (t: string): t is ContainerType =>
  (CONTAINERS as readonly string[]).includes(t)
export const isContainer = (
  b: Block
): b is Extract<Block, { children: Block[] }> => "children" in b

// Nesting rules, kept shallow so the HTML stays reliable across clients:
// columns hold only columns; a column holds only leaf blocks; a section holds anything but sections.
export function canContain(parent: BlockType | null, child: BlockType) {
  if (child === "column") return parent === "columns"
  if (parent === "columns") return false
  if (parent === "column") return !isContainerType(child)
  if (parent === "section") return child !== "section"
  return true
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)

export function newBlock(type: BlockType, cols = 2): Block {
  const b: Record<string, unknown> = { id: uid(), type, ...DEFAULTS[type] }
  if (isContainerType(type))
    b.children =
      type === "columns"
        ? Array.from({ length: cols }, () => newBlock("column"))
        : []
  return b as Block
}

// --- Tree edits. Each returns a new tree, or the same tree if the edit isn't allowed. ---

type Mode = "before" | "after" | "inside"
type Loc = { parent: Block | null; list: Block[]; index: number }

function locate(
  list: Block[],
  id: string,
  parent: Block | null = null
): Loc | null {
  for (let i = 0; i < list.length; i++) {
    const b = list[i]
    if (b.id === id) return { parent, list, index: i }
    const found = isContainer(b) && locate(b.children, id, b)
    if (found) return found
  }
  return null
}

// Mutates `tree`; callers pass a fresh clone.
function place(
  tree: Block[],
  block: Block,
  targetId: string | null,
  mode: Mode
) {
  if (targetId === null)
    return canContain(null, block.type) && tree.push(block) > 0
  const loc = locate(tree, targetId)
  if (!loc) return false
  const target = loc.list[loc.index]
  if (mode === "inside")
    return (
      isContainer(target) &&
      canContain(target.type, block.type) &&
      target.children.push(block) > 0
    )
  if (!canContain(loc.parent?.type ?? null, block.type)) return false
  loc.list.splice(loc.index + (mode === "after" ? 1 : 0), 0, block)
  return true
}

export function insertBlock(
  tree: Block[],
  block: Block,
  targetId: string | null,
  mode: Mode
) {
  const next = structuredClone(tree)
  return place(next, block, targetId, mode) ? next : tree
}

export function moveBlock(
  tree: Block[],
  id: string,
  targetId: string,
  mode: Mode
) {
  const next = structuredClone(tree)
  const loc = locate(next, id)
  if (!loc) return tree
  const [b] = loc.list.splice(loc.index, 1)
  if (locate([b], targetId)) return tree // can't drop a block into itself
  return place(next, b, targetId, mode) ? next : tree
}

export function removeBlock(tree: Block[], id: string) {
  const next = structuredClone(tree)
  const loc = locate(next, id)
  if (!loc) return tree
  loc.list.splice(loc.index, 1)
  return next
}

export function updateBlock(
  tree: Block[],
  id: string,
  patch: Record<string, unknown>
) {
  const next = structuredClone(tree)
  const loc = locate(next, id)
  if (!loc) return tree
  Object.assign(loc.list[loc.index], patch)
  return next
}

export function nudgeBlock(tree: Block[], id: string, delta: number) {
  const next = structuredClone(tree)
  const loc = locate(next, id)
  const to = (loc?.index ?? -1) + delta
  if (!loc || to < 0 || to >= loc.list.length) return tree
  loc.list.splice(to, 0, ...loc.list.splice(loc.index, 1))
  return next
}

export function findBlock(tree: Block[], id: string | null) {
  const loc = id ? locate(tree, id) : null
  return loc ? loc.list[loc.index] : undefined
}

// --- Validation of untrusted JSON (imports, localStorage). ---

export type Kind = "number" | "color" | "align" | "body" | "text"

export function kindOf(key: string, value: unknown): Kind {
  if (typeof value === "number") return "number"
  if (key === "align") return "align"
  if (key === "body" || key === "items") return "body"
  if (/color|bg/i.test(key)) return "color"
  return "text"
}

function valid(kind: Kind, v: unknown) {
  switch (kind) {
    case "number":
      return typeof v === "number" && Number.isFinite(v) && v >= 0
    case "color":
      return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)
    case "align":
      return v === "left" || v === "center" || v === "right"
    default:
      return typeof v === "string"
  }
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null
const matches = (shape: object, o: Obj) =>
  Object.entries(shape).every(([k, v]) => valid(kindOf(k, v), o[k]))
const pick = (shape: object, o: Obj) =>
  Object.fromEntries(Object.keys(shape).map((k) => [k, o[k]]))

function cleanBlock(b: unknown, parent: BlockType | null): Block | null {
  if (
    !isObj(b) ||
    typeof b.type !== "string" ||
    !Object.hasOwn(DEFAULTS, b.type)
  )
    return null
  const type = b.type as BlockType
  // Fields added in later versions are filled from defaults, so older drafts keep loading.
  const fields = { ...DEFAULTS[type], ...b }
  if (!canContain(parent, type) || !matches(DEFAULTS[type], fields)) return null
  const out: Obj = { id: uid(), type, ...pick(DEFAULTS[type], fields) }
  if (isContainerType(type)) {
    if (!Array.isArray(b.children)) return null
    if (type === "columns" && (b.children.length < 1 || b.children.length > 4))
      return null
    const kids = b.children.map((c) => cleanBlock(c, type))
    if (kids.some((k) => !k)) return null
    out.children = kids
  }
  return out as Block
}

// Returns a clean doc with fresh ids, or null.
export function parseDoc(json: string): EmailDoc | null {
  try {
    const d: unknown = JSON.parse(json)
    if (!isObj(d) || !isObj(d.settings) || !Array.isArray(d.blocks)) return null
    const settings = { ...DEFAULT_SETTINGS, ...d.settings }
    if (!matches(DEFAULT_SETTINGS, settings)) return null
    const blocks = d.blocks.map((b) => cleanBlock(b, null))
    if (blocks.some((b) => !b)) return null
    return {
      settings: pick(DEFAULT_SETTINGS, settings) as Settings,
      blocks: blocks as Block[],
    }
  } catch {
    return null
  }
}

// --- HTML rendering. ---

export const safeUrl = (u: string) =>
  /^(https?:|mailto:)/i.test(u.trim()) ? u.trim() : undefined

const FONT = "Helvetica, Arial, sans-serif"
const MONO = "Menlo, Consolas, monospace"
const HEADINGS = {
  title: ["h1", 32],
  subtitle: ["h2", 24],
  heading: ["h3", 20],
} as const
const MOBILE_CSS =
  "@media (max-width:620px){.col{display:block!important;width:100%!important;padding:0!important}}"

const listItems = (s: string) =>
  s.split("\n").filter((l) => plainText(l).trim())
const rich = (s: string) => renderInline(s, safeUrl)

// Preview-only attributes (edit mode): blocks become selectable and their text editable in place.
// Exported HTML and React source are rendered with edit=false, so they never contain these.
// Rich fields allow inline formatting; the rest (button labels, code) stay plain text.
const blockAttrs = (edit: boolean, b: Block) =>
  edit ? { "data-block": b.id } : {}
const fieldAttrs = (edit: boolean, field: string, isRich = false) =>
  edit
    ? {
        "data-field": field,
        ...(isRich && { "data-rich": "" }),
        contentEditable: isRich ? true : ("plaintext-only" as const),
        suppressContentEditableWarning: true,
      }
    : {}
const EDIT_CSS = `
[data-block]:hover:not(:has([data-block]:hover)){outline:1px dashed #60a5fa;outline-offset:-1px}
[data-selected]{outline:2px solid #3b82f6 !important;outline-offset:-2px}
[data-field]{cursor:text}
[data-field]:focus{outline:none}
[data-field]:empty{min-height:1em;min-width:2em}`

// Every block is a React Email <Section> (a centered, full-width presentation table), so the
// structure matches what React Email users write by hand and what the React export imports.
// `outer` is the width this block's cell spans; `padX` is its horizontal padding.
function BlockRow({
  b,
  outer,
  padX,
  edit,
}: {
  b: Block
  outer: number
  padX: number
  edit: boolean
}) {
  const attrs = blockAttrs(edit, b)
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
        {...{ bgcolor: b.bg }}
        style={{ backgroundColor: b.bg, padding: b.padding }}
      >
        <Blocks
          blocks={b.children}
          outer={outer - 2 * b.padding}
          padX={0}
          edit={edit}
        />
      </Section>
    )
  const inner = outer - 2 * padX
  return (
    <Section
      {...attrs}
      style={{
        padding: `8px ${padX}px`,
        ...("align" in b && { textAlign: b.align }),
      }}
    >
      {b.type === "columns" ? (
        <ColumnsView b={b} inner={inner} edit={edit} />
      ) : (
        <BlockView b={b} inner={inner} edit={edit} />
      )}
    </Section>
  )
}

function Blocks({
  blocks,
  outer,
  padX,
  edit,
}: {
  blocks: Block[]
  outer: number
  padX: number
  edit: boolean
}) {
  return (
    <>
      {blocks.map((b) => (
        <BlockRow key={b.id} b={b} outer={outer} padX={padX} edit={edit} />
      ))}
    </>
  )
}

function ColumnsView({
  b,
  inner,
  edit,
}: {
  b: Extract<Block, { type: "columns" }>
  inner: number
  edit: boolean
}) {
  const n = b.children.length
  const w = Math.floor((inner - b.gap * (n - 1)) / n)
  return (
    <Row>
      {b.children.map((c, i) => (
        <Column
          key={c.id}
          {...blockAttrs(edit, c)}
          className="col"
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
            edit={edit}
          />
        </Column>
      ))}
    </Row>
  )
}

type Leaf = Exclude<
  Block,
  { type: "spacer" | "section" | "columns" | "column" }
>

function BlockView({
  b,
  inner,
  edit,
}: {
  b: Leaf
  inner: number
  edit: boolean
}) {
  const text = {
    margin: 0,
    fontFamily: FONT,
    fontSize: 16,
    lineHeight: 1.6,
    color: "color" in b ? b.color : undefined,
  }
  switch (b.type) {
    case "title":
    case "subtitle":
    case "heading": {
      const [as, size] = HEADINGS[b.type]
      return (
        <Heading
          as={as}
          {...fieldAttrs(edit, "text", true)}
          style={{
            ...text,
            fontSize: size,
            lineHeight: 1.25,
            textAlign: b.align,
          }}
        >
          {rich(b.text)}
        </Heading>
      )
    }
    case "text":
      return (
        <Text
          {...fieldAttrs(edit, "body", true)}
          style={{ ...text, textAlign: b.align }}
        >
          {rich(b.body)}
        </Text>
      )
    case "bulletList":
    case "numberedList": {
      const L = b.type === "bulletList" ? "ul" : "ol"
      return (
        <L
          {...fieldAttrs(edit, "items", true)}
          style={{ ...text, paddingLeft: 24 }}
        >
          {listItems(b.items).map((item, i) => (
            <li key={i}>{rich(item)}</li>
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
            style={{ ...text, fontStyle: "italic" }}
          >
            {rich(b.body)}
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
      const img = (
        <Img
          src={safeUrl(b.src)}
          alt={b.alt}
          width={inner}
          style={{ width: "100%", height: "auto" }}
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
            borderRadius: 6,
            fontFamily: FONT,
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          {edit ? <span {...fieldAttrs(edit, "text")}>{b.text}</span> : b.text}
        </Button>
      )
    case "divider":
      return <Hr style={{ borderTop: `1px solid ${b.color}`, margin: 0 }} />
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
const renderDocument = (doc: EmailDoc, edit: boolean) =>
  DOCTYPE +
  renderToStaticMarkup(emailElement(doc, edit)).replace(
    /<link rel="preload" as="image"[^>]*\/>/g,
    ""
  )

export const toHtml = (doc: EmailDoc) => renderDocument(doc, false)

// The preview's markup: same email plus selection/edit attributes. Never export this.
export const toEditableHtml = (doc: EmailDoc) => renderDocument(doc, true)

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
  if (name === "bgcolor") return `{...{ bgcolor: ${jsString(v)} }}`
  if (typeof v === "string")
    return /["\\&{}\n]/.test(v) ? `${name}={${jsString(v)}}` : `${name}="${v}"`
  if (typeof v === "object" && v) return `${name}={${jsObject(v)}}`
  return `${name}={${jsString(v)}}`
}

const jsxText = (t: string) =>
  /^[^{}<>&\n]+$/.test(t) && t.trim() === t ? t : `{${jsString(t)}}`

function jsx(node: ReactNode, depth: number, used: Set<string>): string[] {
  const pad = "  ".repeat(depth)
  if (node == null || typeof node === "boolean") return []
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
  const body = jsx(emailElement(doc, false), 2, used)
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
    case "divider":
      return "---"
    case "spacer":
      return ""
    case "section":
    case "columns":
    case "column":
      return joinText(b.children)
  }
}
const joinText = (blocks: Block[]) =>
  blocks.map(textOf).filter(Boolean).join("\n\n")
export const toText = (doc: EmailDoc) => joinText(doc.blocks) + "\n"

function emailElement({ settings: s, blocks }: EmailDoc, edit: boolean) {
  return (
    <Html lang="en">
      <Head>
        <style dangerouslySetInnerHTML={{ __html: MOBILE_CSS }} />
        {edit && <style dangerouslySetInnerHTML={{ __html: EDIT_CSS }} />}
      </Head>
      <Body
        style={{
          backgroundColor: s.bg,
          margin: 0,
          padding: "24px 12px",
          fontFamily: FONT,
        }}
      >
        {s.preview.trim() && <Preview>{s.preview}</Preview>}
        {/* The width attribute holds the layout in Outlook, which ignores max-width. */}
        <Container
          width={s.width}
          style={{
            width: "100%",
            maxWidth: s.width,
            backgroundColor: s.contentBg,
          }}
        >
          <Blocks blocks={blocks} outer={s.width} padX={24} edit={edit} />
        </Container>
      </Body>
    </Html>
  )
}
