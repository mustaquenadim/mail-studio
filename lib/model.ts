// The email data model: block types, defaults, tree edits and validation. No React, so server
// routes can import it (lib/email.tsx re-exports it and adds rendering).
import { plainText } from "./rich"

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
export type Font = ReturnType<typeof type>
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
