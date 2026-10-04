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

// Fields whose value is one of a fixed list. The form shows a select; validation checks membership.
export const OPTIONS = {
  align: ["left", "center", "right"],
  vAlign: ["top", "middle", "bottom"],
  fontFamily: [
    "Helvetica",
    "Arial",
    "Georgia",
    "Verdana",
    "Times New Roman",
    "Courier New",
  ],
  fontWeight: ["normal", "bold", "300", "500", "600", "700"],
  socialMode: ["horizontal", "vertical"],
  dir: ["ltr", "rtl"],
} as const
type Opt<K extends keyof typeof OPTIONS> = (typeof OPTIONS)[K][number]

export const FONTS: Record<Opt<"fontFamily">, string> = {
  Helvetica: "Helvetica, Arial, sans-serif",
  Arial: "Arial, Helvetica, sans-serif",
  Georgia: "Georgia, 'Times New Roman', serif",
  Verdana: "Verdana, Geneva, sans-serif",
  "Times New Roman": "'Times New Roman', Times, serif",
  "Courier New": "'Courier New', Courier, monospace",
}

const LEFT = "left" as Opt<"align">
const CENTER = "center" as Opt<"align">
// Font fields shared by text-like blocks.
const type = (fontSize: number, fontWeight = "normal", lineHeight = 1.6) => ({
  fontFamily: "Helvetica" as Opt<"fontFamily">,
  fontSize,
  fontWeight: fontWeight as Opt<"fontWeight">,
  lineHeight,
})
// Vertical space around a leaf block (px).
const SPACING = { spacing: 8 }

// Default fields per block type. Doubles as the schema: field kinds are inferred from these.
// List-like content is newline text ("Label | url" per line), so the generic form edits it.
export const DEFAULTS = {
  text: {
    body: "Write your message here.",
    color: "#333333",
    align: LEFT,
    ...type(16),
    ...SPACING,
  },
  title: {
    text: "Title",
    color: "#111111",
    align: LEFT,
    ...type(32, "bold", 1.25),
    ...SPACING,
  },
  subtitle: {
    text: "Subtitle",
    color: "#111111",
    align: LEFT,
    ...type(24, "bold", 1.25),
    ...SPACING,
  },
  heading: {
    text: "Heading",
    color: "#111111",
    align: LEFT,
    ...type(20, "bold", 1.25),
    ...SPACING,
  },
  bulletList: {
    items: "First item\nSecond item\nThird item",
    color: "#333333",
    ...type(16),
    ...SPACING,
  },
  numberedList: {
    items: "First item\nSecond item\nThird item",
    color: "#333333",
    ...type(16),
    ...SPACING,
  },
  quote: {
    body: "A memorable quote.",
    color: "#555555",
    borderColor: "#d4d4d8",
    ...type(16),
    ...SPACING,
  },
  code: {
    body: 'const greeting = "Hello"',
    color: "#e4e4e7",
    bg: "#18181b",
    ...SPACING,
  },
  button: {
    text: "Call to action",
    href: "https://example.com",
    bg: "#2563eb",
    color: "#ffffff",
    align: CENTER,
    radius: 6,
    fullWidth: false,
    ...type(16, "600"),
    ...SPACING,
  },
  divider: { color: "#e5e5e5", thickness: 1, ...SPACING },
  section: { bg: "#ffffff", bgImage: "", padding: 24 },
  wrapper: { bg: "#f8fafc", borderColor: "#e5e5e5", radius: 0, padding: 16 },
  hero: {
    bgImage: "https://placehold.co/600x300/1e293b/334155/png",
    bg: "#1e293b",
    height: 280,
    vAlign: "middle" as Opt<"vAlign">,
    padding: 32,
  },
  columns: { gap: 16, stackOnMobile: true },
  column: {},
  image: {
    src: "https://placehold.co/600x300/png",
    alt: "",
    href: "",
    size: 100,
    align: CENTER,
    radius: 0,
    ...SPACING,
  },
  spacer: { height: 24 },
  navbar: {
    links:
      "Home | https://example.com\nAbout | https://example.com/about\nContact | https://example.com/contact",
    color: "#111111",
    align: CENTER,
    ...type(14, "500"),
    ...SPACING,
  },
  social: {
    networks:
      "facebook | https://facebook.com\ntwitter | https://x.com\nlinkedin | https://linkedin.com",
    iconSize: 24,
    socialMode: "horizontal" as Opt<"socialMode">,
    align: CENTER,
    ...SPACING,
  },
  accordion: {
    panels:
      "What is this? | A short answer.\nHow do I start? | Another short answer.",
    color: "#333333",
    bg: "#f4f4f5",
    borderColor: "#e5e5e5",
    ...type(15),
    ...SPACING,
  },
  carousel: {
    images:
      "https://placehold.co/600x300/png?text=1\nhttps://placehold.co/600x300/png?text=2\nhttps://placehold.co/600x300/png?text=3",
    radius: 6,
    ...SPACING,
  },
  table: {
    rows: "Plan | Price\nBasic | $9\nPro | $29",
    header: true,
    color: "#333333",
    borderColor: "#e5e5e5",
    cellPadding: 8,
    ...type(14),
    ...SPACING,
  },
  raw: { html: '<p style="margin:0">Custom HTML</p>', ...SPACING },
}

const CONTAINERS = ["section", "wrapper", "hero", "columns", "column"] as const
type ContainerType = (typeof CONTAINERS)[number]
type Defaults = typeof DEFAULTS

// Optional on every block: locked blocks can't be edited, moved or deleted; `slot` marks a layout's content area.
type Meta = { locked?: boolean; slot?: string }
export type BlockType = keyof Defaults
type LeafType = Exclude<BlockType, ContainerType>
type LeafBlock = {
  [T in LeafType]: { id: string; type: T } & Defaults[T] & Meta
}[LeafType]
// Interfaces (not mapped types) so the recursive `children: Block[]` type-checks.
interface Container<T extends ContainerType> extends Meta {
  id: string
  type: T
  children: Block[]
}
type SectionFields = Defaults["section"]
type WrapperFields = Defaults["wrapper"]
type HeroFields = Defaults["hero"]
type ColumnsFields = Defaults["columns"]
interface SectionBlock extends Container<"section">, SectionFields {}
interface WrapperBlock extends Container<"wrapper">, WrapperFields {}
interface HeroBlock extends Container<"hero">, HeroFields {}
interface ColumnsBlock extends Container<"columns">, ColumnsFields {}
type ColumnBlock = Container<"column">
export type Block =
  | LeafBlock
  | SectionBlock
  | WrapperBlock
  | HeroBlock
  | ColumnsBlock
  | ColumnBlock

export const DEFAULT_SETTINGS = {
  // Sets <title> and pre-fills the test-send form.
  subject: "",
  // The preheader: the line inbox lists show after the subject. Hidden in the email body.
  preview: "",
  bg: "#f4f4f5",
  contentBg: "#ffffff",
  width: 600,
  // Off = "scale mode": no mobile media query, the email keeps its width.
  responsive: true,
  breakpoint: 620,
  lang: "en",
  dir: "ltr" as Opt<"dir">,
  fontUrls: "",
  css: "",
  // Active layout id (see lib/templates.ts); not shown in the form.
  layout: "",
}
export type Settings = typeof DEFAULT_SETTINGS
export type EmailDoc = { settings: Settings; blocks: Block[] }

const isContainerType = (t: string): t is ContainerType =>
  (CONTAINERS as readonly string[]).includes(t)
export const isContainer = (
  b: Block
): b is Extract<Block, { children: Block[] }> => "children" in b

// Nesting rules, kept shallow so the HTML stays reliable across clients:
// columns hold only columns; columns and heroes hold only leaf blocks; wrappers hold sections and heroes;
// wrappers and heroes sit at the top level; a section holds anything but sections.
export function canContain(parent: BlockType | null, child: BlockType) {
  if (child === "column") return parent === "columns"
  if (parent === "columns") return false
  if (parent === "column" || parent === "hero") return !isContainerType(child)
  if (parent === "wrapper") return child === "section" || child === "hero"
  if (child === "wrapper" || child === "hero") return parent === null
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

// "Label | rest" lines. The rest may contain "|".
export const pairs = (s: string) =>
  s
    .split("\n")
    .map((l) => {
      const i = l.indexOf("|")
      return i < 0
        ? [l.trim(), ""]
        : [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
    .filter(([a, b]) => a || b)

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

// The block and its ancestors, outermost first; [] if not found.
export function pathTo(tree: Block[], id: string | null): Block[] {
  for (const b of tree) {
    if (b.id === id) return [b]
    const sub = isContainer(b) ? pathTo(b.children, id) : []
    if (sub.length) return [b, ...sub]
  }
  return []
}

// Locked blocks (and everything inside them) refuse every edit below except setLocked.
export const isLocked = (tree: Block[], id: string | null | undefined) =>
  !!id && pathTo(tree, id).some((b) => b.locked)

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
      !isLocked(tree, target.id) &&
      isContainer(target) &&
      canContain(target.type, block.type) &&
      target.children.push(block) > 0
    )
  if (isLocked(tree, loc.parent?.id)) return false
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
  if (isLocked(tree, id)) return tree
  const next = structuredClone(tree)
  const loc = locate(next, id)
  if (!loc) return tree
  const [b] = loc.list.splice(loc.index, 1)
  if (locate([b], targetId)) return tree // can't drop a block into itself
  return place(next, b, targetId, mode) ? next : tree
}

export function removeBlock(tree: Block[], id: string) {
  if (isLocked(tree, id)) return tree
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
  if (isLocked(tree, id)) return tree
  const next = structuredClone(tree)
  const loc = locate(next, id)
  if (!loc) return tree
  Object.assign(loc.list[loc.index], patch)
  return next
}

export function nudgeBlock(tree: Block[], id: string, delta: number) {
  if (isLocked(tree, id)) return tree
  const next = structuredClone(tree)
  const loc = locate(next, id)
  const to = (loc?.index ?? -1) + delta
  if (!loc || to < 0 || to >= loc.list.length) return tree
  loc.list.splice(to, 0, ...loc.list.splice(loc.index, 1))
  return next
}

// The one edit allowed on locked blocks.
export function setLocked(tree: Block[], id: string, locked: boolean) {
  const next = structuredClone(tree)
  const loc = locate(next, id)
  if (!loc) return tree
  const b = loc.list[loc.index]
  if (locked) b.locked = true
  else delete b.locked
  return next
}

// Fresh ids everywhere, locks dropped (a copy is meant to be edited).
function cloneFresh(b: Block): Block {
  const { locked: _, ...c } = structuredClone(b)
  void _
  const out = { ...c, id: uid() } as Block
  if (isContainer(out)) out.children = out.children.map(cloneFresh)
  return out
}

// Returns [tree, copy id]; the same tree if not allowed (e.g. columns, or inside a locked block).
export function duplicateBlock(tree: Block[], id: string): [Block[], string] {
  const b = findBlock(tree, id)
  if (!b || b.type === "column") return [tree, id]
  const copy = cloneFresh(b)
  const next = insertBlock(tree, copy, id, "after")
  return next === tree ? [tree, id] : [next, copy.id]
}

// "Turn into": swap between text-like types, keeping the text.
export const TEXT_TYPES = [
  "text",
  "title",
  "subtitle",
  "heading",
  "quote",
  "code",
] as const
export function convertBlock(tree: Block[], id: string, to: BlockType) {
  const b = findBlock(tree, id)
  const from = b && "text" in b ? b.text : b && "body" in b ? b.body : null
  if (!b || from === null || isLocked(tree, id)) return tree
  if (!(TEXT_TYPES as readonly string[]).includes(to)) return tree
  const next = structuredClone(tree)
  const loc = locate(next, id)!
  const nb = newBlock(to) as Record<string, unknown>
  nb.id = b.id
  if (b.slot) nb.slot = b.slot
  if ("text" in nb)
    nb.text = b.type === "code" ? from : from.replace(/\n/g, " ")
  else nb.body = to === "code" ? plainText(from) : from
  loc.list[loc.index] = nb as Block
  return next
}

export function findBlock(tree: Block[], id: string | null) {
  const loc = id ? locate(tree, id) : null
  return loc ? loc.list[loc.index] : undefined
}

// --- Validation of untrusted JSON (imports, localStorage). ---

export type Kind = "number" | "boolean" | "color" | "select" | "body" | "text"

// Multi-line fields (a textarea in the form).
const BODY_KEYS = new Set([
  "body",
  "items",
  "links",
  "networks",
  "panels",
  "images",
  "rows",
  "html",
  "css",
  "fontUrls",
])

export function kindOf(key: string, value: unknown): Kind {
  if (typeof value === "number") return "number"
  if (typeof value === "boolean") return "boolean"
  if (Object.hasOwn(OPTIONS, key)) return "select"
  if (BODY_KEYS.has(key)) return "body"
  if (key === "bgImage") return "text"
  if (/color|bg/i.test(key)) return "color"
  return "text"
}

function valid(key: string, kind: Kind, v: unknown) {
  switch (kind) {
    case "number":
      return typeof v === "number" && Number.isFinite(v) && v >= 0
    case "boolean":
      return typeof v === "boolean"
    case "color":
      return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)
    case "select":
      return (
        OPTIONS[key as keyof typeof OPTIONS] as readonly unknown[]
      ).includes(v)
    default:
      return typeof v === "string"
  }
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null
const matches = (shape: object, o: Obj) =>
  Object.entries(shape).every(([k, v]) => valid(k, kindOf(k, v), o[k]))
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
  if (b.locked === true) out.locked = true
  if (typeof b.slot === "string" && b.slot) out.slot = b.slot
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
type Font = ReturnType<typeof type>
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
html{scrollbar-width:thin;scrollbar-color:rgb(128 128 128/.5) transparent}`
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
