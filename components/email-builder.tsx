"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type DragEvent,
  type Ref,
} from "react"
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Ruler,
  Laptop,
  Smartphone,
  Tablet,
  CodeXml,
  Columns2,
  Columns3,
  Columns4,
  Copy,
  Eye,
  FileCode,
  GalleryHorizontal,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  LayoutGrid,
  List,
  ListOrdered,
  Lock,
  LockOpen,
  Menu,
  Monitor,
  MousePointer2,
  MoveVertical,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PanelTop,
  Pencil,
  RectangleVertical,
  Redo2,
  Rows2,
  SeparatorHorizontal,
  Share2,
  SquareCode,
  SquareDashed,
  Table,
  TextQuote,
  Trash2,
  Undo2,
  Blocks,
  Layers,
  LayoutTemplate,
  PanelsTopLeft,
} from "lucide-react"
import { HexColorInput, HexColorPicker } from "react-colorful"
import { cn, isTypingTarget } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { CodeView, save } from "@/components/code-view"
import { BottomPanel } from "@/components/bottom-panel"
import {
  DRAG_TYPE,
  EditablePreview,
  type DropMode,
  type SlashCommand,
} from "@/components/editable-preview"
import { allBlocks } from "@/lib/checks"
import { plainText } from "@/lib/rich"
import { Tip } from "@/components/tip"
import { ThemeToggle } from "@/components/theme-provider"
import { SettingsDialog } from "@/components/settings-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useIsMobile } from "@/hooks/use-mobile"
import { useHistory } from "@/lib/history"
import {
  fromHtml,
  fromMarkdown,
  fromMjml,
  toMarkdown,
  toMjml,
} from "@/lib/convert"
import { LAYOUTS, applyLayout, detachLayout } from "@/lib/templates"
import { COLLECTIONS } from "@/lib/collections"

// Every themed template, grouped by email type (Welcome, Password reset, …) for the Templates panel.
const THEMED = COLLECTIONS.flatMap((c) =>
  c.templates.map((t) => ({ ...t, theme: c }))
)
const TEMPLATE_TYPES = Object.entries(Object.groupBy(THEMED, (t) => t.name))
import {
  DEFAULT_SETTINGS,
  OPTIONS,
  TEXT_TYPES,
  convertBlock,
  duplicateBlock,
  findBlock,
  insertBlock,
  isContainer,
  isLocked,
  kindOf,
  moveBlock,
  newBlock,
  nudgeBlock,
  parseDoc,
  pathTo,
  removeBlock,
  setLocked,
  toEditableHtml,
  toHtml,
  updateBlock,
  type Block,
  type BlockType,
  type EmailDoc,
} from "@/lib/email"

const SIDES = ["top", "right", "bottom", "left"] as const
type Side = (typeof SIDES)[number]
type Size = { w: number; h: number }
// No height means "fill the preview area" (width presets only set the width).
type PreviewSize = { w: number; h?: number }

const BREAKPOINTS: { label: string; w: number | null; icon: Icon }[] = [
  { label: "Small phone", w: 320, icon: Smartphone },
  { label: "Phone", w: 375, icon: Smartphone },
  { label: "Large phone", w: 430, icon: Smartphone },
  { label: "Tablet", w: 768, icon: Tablet },
  { label: "Tablet landscape", w: 1024, icon: Tablet },
  { label: "Laptop", w: 1280, icon: Laptop },
  { label: "Desktop", w: null, icon: Monitor },
]
const MOBILE_W = 375

// The frame is centered, so moving one edge by d grows that axis by 2d.
const grow = (s: Size, side: Side, d: number): Size =>
  side === "left" || side === "right"
    ? { w: Math.max(280, s.w + 2 * d), h: s.h }
    : { w: s.w, h: Math.max(200, s.h + 2 * d) }

const EMPTY: EmailDoc = { settings: DEFAULT_SETTINGS, blocks: [] }

type Icon = ComponentType<{ className?: string }>

const TYPES: Record<BlockType, { label: string; icon: Icon }> = {
  text: { label: "Text", icon: AlignLeft },
  title: { label: "Title", icon: Heading1 },
  subtitle: { label: "Subtitle", icon: Heading2 },
  heading: { label: "Heading", icon: Heading3 },
  bulletList: { label: "Bullet list", icon: List },
  numberedList: { label: "Numbered list", icon: ListOrdered },
  quote: { label: "Quote", icon: TextQuote },
  code: { label: "Code block", icon: SquareCode },
  button: { label: "Button", icon: MousePointer2 },
  divider: { label: "Divider", icon: SeparatorHorizontal },
  section: { label: "Section", icon: Rows2 },
  columns: { label: "Columns", icon: Columns2 },
  column: { label: "Column", icon: RectangleVertical },
  image: { label: "Image", icon: ImageIcon },
  spacer: { label: "Spacer", icon: MoveVertical },
  wrapper: { label: "Wrapper", icon: SquareDashed },
  hero: { label: "Hero", icon: PanelTop },
  navbar: { label: "Navbar", icon: Menu },
  social: { label: "Social icons", icon: Share2 },
  accordion: { label: "Accordion", icon: ChevronsUpDown },
  carousel: { label: "Carousel", icon: GalleryHorizontal },
  table: { label: "Table", icon: Table },
  raw: { label: "Raw HTML", icon: FileCode },
}

type PaletteItem = {
  type: BlockType
  label?: string
  icon?: Icon
  cols?: number
}
const PALETTE: [string, PaletteItem[]][] = [
  [
    "Text",
    [
      { type: "text" },
      { type: "title" },
      { type: "subtitle" },
      { type: "heading" },
      { type: "bulletList" },
      { type: "numberedList" },
      { type: "quote" },
      { type: "code" },
    ],
  ],
  [
    "Layout",
    [
      { type: "button" },
      { type: "divider" },
      { type: "section" },
      { type: "columns", cols: 2, label: "2 columns", icon: Columns2 },
      { type: "columns", cols: 3, label: "3 columns", icon: Columns3 },
      { type: "columns", cols: 4, label: "4 columns", icon: Columns4 },
      { type: "spacer" },
      { type: "wrapper" },
      { type: "hero" },
    ],
  ],
  [
    "Content",
    [
      { type: "image" },
      { type: "table" },
      { type: "navbar" },
      { type: "social" },
      { type: "raw" },
    ],
  ],
  ["Interactive", [{ type: "accordion" }, { type: "carousel" }]],
]
// The "/" menu in the preview offers the same blocks; its key is the index into this list.
const SLASH_ITEMS = PALETTE.flatMap(([, items]) => items)
const SLASH_COMMANDS: SlashCommand[] = SLASH_ITEMS.map((item, i) => ({
  key: String(i),
  label: item.label ?? TYPES[item.type].label,
  icon: item.icon ?? TYPES[item.type].icon,
}))

const LABELS: Record<string, string> = {
  preview: "Preview text (shown after the subject in the inbox)",
  bg: "Background",
  contentBg: "Content background",
  body: "Text",
  items: "Items (one per line)",
  borderColor: "Border color",
  src: "Image URL",
  alt: "Alt text",
  href: "Link URL",
  height: "Height (px)",
  width: "Width (px)",
  padding: "Padding (px)",
  gap: "Gap (px)",
  subject: "Subject (also the <title>)",
  responsive: "Responsive (off = keep desktop width on phones)",
  breakpoint: "Mobile breakpoint (px)",
  lang: "Language (e.g. en, ar)",
  dir: "Text direction",
  fontUrls: "Web font URLs (one per line)",
  css: "Custom CSS",
  bgImage: "Background image URL",
  spacing: "Spacing above & below (px)",
  fontFamily: "Font",
  fontSize: "Font size (px)",
  fontWeight: "Font weight",
  lineHeight: "Line height",
  radius: "Corner radius (px)",
  fullWidth: "Full width",
  thickness: "Thickness (px)",
  size: "Width (%)",
  vAlign: "Vertical align",
  stackOnMobile: "Stack columns on mobile",
  links: "Links (Label | URL, one per line)",
  networks: "Networks (name | URL, one per line)",
  panels: "Panels (Title | text, one per line)",
  images: "Image URLs (one per line)",
  rows: "Rows (cells separated by |)",
  header: "First row is a header",
  cellPadding: "Cell padding (px)",
  iconSize: "Icon size (px)",
  socialMode: "Layout",
  html: "HTML",
}
// Shown on the "networks" field so people know which names have icons.
const NETWORK_HINT =
  "facebook, x, twitter, linkedin, instagram, youtube, tiktok, github, pinterest, snapchat, medium, dribbble, vimeo, web"
// Fields not shown in the form.
const HIDDEN = new Set(["id", "type", "children", "locked", "slot", "layout"])
// Number fields that also get a slider: [min, max, step].
const RANGES: Record<string, [number, number, number]> = {
  width: [320, 960, 10],
  size: [10, 100, 5],
}
const KEY = "email-builder:doc"

// The four editor modes, like mail-studio: Canvas (structure, drag blocks), Edit (type in place),
// Preview (read-only, as recipients see it), Code (source with a live preview).
type View = "canvas" | "edit" | "preview" | "code"
const VIEWS: { id: View; label: string; icon: Icon; tip: string }[] = [
  {
    id: "canvas",
    label: "Canvas",
    icon: LayoutGrid,
    tip: "Arrange blocks: drag, select, reorder",
  },
  {
    id: "edit",
    label: "Edit",
    icon: Pencil,
    tip: "Type and format text in place; / adds a block",
  },
  {
    id: "preview",
    label: "Preview",
    icon: Eye,
    tip: "See the email as recipients will",
  },
  {
    id: "code",
    label: "Code",
    icon: CodeXml,
    tip: "React, HTML, MJML, Markdown, JSON",
  },
]

const labelFor = (k: string) => LABELS[k] ?? k[0].toUpperCase() + k.slice(1)
const summary = (b: Block) =>
  "text" in b
    ? plainText(b.text)
    : "body" in b
      ? plainText(b.body)
      : "items" in b
        ? plainText(b.items.split("\n")[0])
        : "src" in b
          ? b.src
          : b.type === "columns"
            ? `${b.children.length} columns`
            : b.type === "navbar"
              ? b.links.split("\n")[0]
              : b.type === "social"
                ? b.networks
                    .split("\n")
                    .map((l) => l.split("|")[0].trim())
                    .join(", ")
                : b.type === "accordion"
                  ? b.panels.split("|")[0]
                  : b.type === "table"
                    ? b.rows.split("\n")[0]
                    : b.type === "carousel"
                      ? `${b.images.split("\n").filter((l) => l.trim()).length} images`
                      : b.type === "raw"
                        ? b.html
                        : ""

// Locked blocks compared by content (imports get fresh ids).
const lockedSigs = (blocks: Block[]) =>
  allBlocks(blocks)
    .filter((b) => b.locked)
    .map((b) => JSON.stringify(b, (k, v) => (k === "id" ? undefined : v)))
    .sort()
    .join("\n")
const IMPORTERS: [RegExp, (src: string) => EmailDoc | null, string][] = [
  [/\.json$/i, parseDoc, "email JSON"],
  [/\.mjml$/i, fromMjml, "MJML"],
  [/\.html?$/i, fromHtml, "HTML"],
  [/\.(md|markdown)$/i, fromMarkdown, "Markdown"],
]

export function EmailBuilder() {
  const history = useHistory<EmailDoc>(EMPTY)
  const doc = history.value
  const { set: setDoc, reset: resetDoc } = history
  const [loaded, setLoaded] = useState(false)
  const [selectedId, setSelected] = useState<string | null>(null)
  const selected = selectedId
  const [dragId, setDragId] = useState<string | null>(null)
  const [msg, setMsg] = useState("")
  const [showBlocks, setShowBlocks] = useState(true)
  const [showProps, setShowProps] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef<(Size & { x: number; y: number }) | null>(null)
  // null = fill the preview area.
  const [size, setSize] = useState<PreviewSize | null>(null)
  const [view, setView] = useState<View>("canvas")
  // Pending destructive action awaiting confirmation in the dialog.
  const [ask, setAsk] = useState<{ title: string; run: () => void } | null>(
    null
  )
  const blockView = view === "canvas" || view === "edit"
  const sidePanels = view === "canvas"
  const isMobile = useIsMobile()
  const [leftTab, setLeftTab] = useState("library")
  // Which preset matches the current size, if any ("" after a custom drag).
  const preset =
    size === null
      ? "fill"
      : size.h === undefined && BREAKPOINTS.some((b) => b.w === size.w)
        ? String(size.w)
        : "custom"
  const widthRef = useRef<HTMLInputElement>(null)
  const focusCustom = useRef(false)
  const applyPreset = (v: string) => {
    // "Custom" keeps the size and moves focus to the width field when the menu closes.
    if (v === "custom") focusCustom.current = true
    else setSize(v === "fill" ? null : { w: Number(v) })
  }
  const setWidth = (w?: number) =>
    setSize((s) => (w === undefined ? null : { w, h: s?.h }))
  const setHeight = (h?: number) =>
    setSize((s) => {
      const w = s?.w ?? frameRef.current?.getBoundingClientRect().width
      return w === undefined ? s : { w, h }
    })

  // localStorage only exists in the browser, so load after mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      const d = parseDoc(raw ?? "")
      if (d) resetDoc(d)
      // Keep an unreadable draft instead of overwriting it with an empty one.
      else if (raw) localStorage.setItem(`${KEY}:unreadable`, raw)
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from browser storage
    setLoaded(true)
  }, [resetDoc])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(KEY, JSON.stringify(doc))
    } catch {}
  }, [doc, loaded])

  const html = useMemo(() => toHtml(doc), [doc])
  const editableHtml = useMemo(
    () => toEditableHtml(doc, view === "canvas" ? "canvas" : "edit"),
    [doc, view]
  )
  const block = findBlock(doc.blocks, selected)
  const path = pathTo(doc.blocks, selected)
  const locked = isLocked(doc.blocks, selected)
  // Locked by an ancestor, so this block's own lock can't be changed here.
  const lockedAbove = path.slice(0, -1).some((b) => b.locked)
  const mjml = useMemo(() => toMjml(doc), [doc])
  // Columns inside a columns block aren't added by hand, so they don't count.
  const layerCount = allBlocks(doc.blocks).filter(
    (b) => b.type !== "column"
  ).length

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(""), 2500)
  }
  // key: edits with the same key in quick succession (typing) become one undo step.
  const edit = (f: (tree: Block[]) => Block[], key?: string) =>
    setDoc((d) => {
      const blocks = f(d.blocks)
      return blocks === d.blocks ? d : { ...d, blocks }
    }, key)

  // Add inside the selected container, else after the selected block, else at the end.
  // From the "/" menu: insert after the block being typed in (or swap it out if it was empty).
  // Falls back to the end of the email when nesting rules don't allow it there.
  const insertFromSlash = (key: string, blockId: string, replace: boolean) => {
    const item = SLASH_ITEMS[Number(key)]
    if (!item) return
    const b = newBlock(item.type, item.cols)
    edit((tree) => {
      let next = insertBlock(tree, b, blockId, "after")
      if (next === tree) next = insertBlock(tree, b, null, "inside")
      if (next !== tree && replace) next = removeBlock(next, blockId)
      return next
    })
    setSelected(b.id)
  }

  const add = ({ type, cols }: PaletteItem) => {
    const b = newBlock(type, cols)
    edit((tree) => {
      const tries = selected
        ? ([
            [selected, "inside"],
            [selected, "after"],
            [null, "inside"],
          ] as const)
        : ([[null, "inside"]] as const)
      for (const [target, mode] of tries) {
        const next = insertBlock(tree, b, target, mode)
        if (next !== tree) return next
      }
      return tree
    })
    setSelected(b.id)
  }
  const remove = (id: string) => {
    if (isLocked(doc.blocks, id)) return flash("That block is locked")
    edit((tree) => removeBlock(tree, id))
    if (selected === id) setSelected(null)
  }
  const duplicate = (id: string) => {
    const [next, copyId] = duplicateBlock(doc.blocks, id)
    if (next === doc.blocks) return flash("Can't duplicate that block here")
    edit(() => next)
    setSelected(copyId)
  }
  const patch = (p: Record<string, unknown>) => {
    const key = Object.keys(p)[0]
    if (block)
      edit((tree) => updateBlock(tree, block.id, p), `${block.id}:${key}`)
    else
      setDoc(
        (d) => ({ ...d, settings: { ...d.settings, ...p } }),
        `settings:${key}`
      )
  }

  const setSetting = (key: string, value: unknown) =>
    setDoc(
      (d) => ({ ...d, settings: { ...d.settings, [key]: value } }),
      `settings:${key}`
    )

  // Replaces the whole email (undoable).
  const load = (d: EmailDoc, message: string) => {
    setDoc(d)
    setSelected(null)
    flash(message)
  }
  const importFile = async (file: File) => {
    const found = IMPORTERS.find(([re]) => re.test(file.name))
    if (!found)
      return flash("Import failed: use a .json, .mjml, .html or .md file")
    const [, parse, what] = found
    const d = parse(await file.text())
    if (!d) return flash(`Import failed: not a valid ${what} file`)
    load(d, `Imported ${what}`)
  }
  // From the code view's editor. Locked blocks must come through unchanged.
  const applyCode = (d: EmailDoc) => {
    if (lockedSigs(d.blocks) !== lockedSigs(doc.blocks))
      return "This edit changes locked blocks. Unlock them first (select the block, then Unlock)."
    setDoc(d)
    setSelected(null)
    flash("Applied")
    return null
  }
  const copyText = (text: string, what: string) =>
    navigator.clipboard.writeText(text).then(() => flash(`Copied ${what}`))

  // A palette item ({type, cols}) or an existing block ({id}) dropped on the tree or the preview.
  // Falls back to the other placement when nesting rules refuse the first one.
  const dropPayload = (
    payload: string,
    targetId: string | null,
    mode: DropMode
  ) => {
    let p: { id?: string; type?: string; cols?: number }
    try {
      p = JSON.parse(payload)
    } catch {
      return
    }
    const fresh =
      p.type && Object.hasOwn(TYPES, p.type)
        ? newBlock(p.type as BlockType, p.cols)
        : null
    const tries: [string | null, DropMode][] = targetId
      ? [
          [targetId, mode],
          [targetId, mode === "inside" ? "before" : "inside"],
        ]
      : [[null, "inside"]]
    edit((tree) => {
      for (const [t, m] of tries) {
        let next = tree
        if (fresh) next = insertBlock(tree, fresh, t, m)
        else if (p.id && t) next = moveBlock(tree, p.id, t, m)
        else if (p.id && !isLocked(tree, p.id)) {
          // Dropped on empty space: move to the end of the email.
          const b = findBlock(tree, p.id)
          const without = removeBlock(tree, p.id)
          const moved = b && insertBlock(without, b, null, "inside")
          next = moved && moved !== without ? moved : tree
        }
        if (next !== tree) return next
      }
      return tree
    })
    if (fresh) setSelected(fresh.id)
    setDragId(null)
  }
  const startDrag = (e: DragEvent, payload: object) => {
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload))
    e.dataTransfer.effectAllowed = "copyMove"
  }
  const dropHere = (e: DragEvent, targetId: string | null, mode: DropMode) => {
    const payload = e.dataTransfer.getData(DRAG_TYPE)
    if (!payload) return
    e.preventDefault()
    e.stopPropagation()
    dropPayload(payload, targetId, mode)
  }

  // App shortcuts. Ignored while typing, so text fields keep their own undo, delete, etc.
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || isTypingTarget(e.target)) return
    const selected = blockView ? selectedId : null
    const mod = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    const run = (f: () => void) => {
      e.preventDefault()
      f()
    }
    if (mod && k === "z") run(e.shiftKey ? history.redo : history.undo)
    else if (mod && k === "y") run(history.redo)
    else if (mod && k === "d" && selected) run(() => duplicate(selected))
    else if (
      mod &&
      e.shiftKey &&
      (e.key === "ArrowUp" || e.key === "ArrowDown") &&
      selected
    )
      run(() =>
        edit((t) => nudgeBlock(t, selected, e.key === "ArrowUp" ? -1 : 1))
      )
    else if ((e.key === "Delete" || e.key === "Backspace") && selected && !mod)
      run(() => remove(selected))
    else if (e.key === "Escape" && selected) run(() => setSelected(null))
  }
  const blockToolbar = block ? (
    <div className="flex items-center gap-0.5 rounded-md bg-blue-600 px-1 py-0.5 text-xs text-white shadow-md">
      <span className="flex items-center gap-1 px-1 font-medium">
        {locked && <Lock aria-label="Locked" className="size-3" />}
        {TYPES[block.type].label}
      </span>
      {block.type !== "column" &&
        !locked &&
        (
          [
            [
              "Move up",
              ArrowUp,
              () => edit((t) => nudgeBlock(t, block.id, -1)),
            ],
            [
              "Move down",
              ArrowDown,
              () => edit((t) => nudgeBlock(t, block.id, 1)),
            ],
            ["Duplicate (Ctrl+D)", Copy, () => duplicate(block.id)],
            ["Delete (Del)", Trash2, () => remove(block.id)],
          ] as const
        ).map(([label, ActionIcon, run]) => (
          <button
            key={label}
            aria-label={label}
            title={label}
            onClick={run}
            className="grid size-5 place-items-center rounded hover:bg-white/20"
          >
            <ActionIcon className="size-3.5" />
          </button>
        ))}
    </div>
  ) : null

  const onKeyRef = useRef(onKey)
  useEffect(() => {
    onKeyRef.current = onKey
  })
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKeyRef.current(e)
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [])

  const renderTree = (list: Block[], parent: Block | null) => (
    <ol
      className={cn("flex flex-col gap-1", parent && "ms-3 mt-1 border-s ps-2")}
    >
      {list.map((b, i) => {
        const { icon: TypeIcon, label } = TYPES[b.type]
        // Columns are fixed by their parent: no drag, reorder or delete. Locked blocks can't move either.
        const fixed = b.type === "column"
        const frozen = fixed || isLocked(doc.blocks, b.id)
        return (
          <li key={b.id}>
            <div
              draggable={!frozen}
              onDragStart={(e) => {
                e.stopPropagation()
                startDrag(e, { id: b.id })
                setDragId(b.id)
              }}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => e.preventDefault()}
              // Dropping on a container puts the block inside it; otherwise it goes before the target.
              onDrop={(e) => dropHere(e, b.id, "inside")}
              className={cn(
                "flex items-center gap-1 rounded-lg border p-1 text-sm",
                selected === b.id && "border-ring bg-muted",
                dragId === b.id && "opacity-50"
              )}
            >
              {frozen ? (
                b.locked ? (
                  <Lock
                    aria-label="Locked"
                    className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
                  />
                ) : (
                  <span className="size-4 shrink-0" />
                )
              ) : (
                <GripVertical
                  aria-hidden
                  className="size-4 shrink-0 cursor-grab text-muted-foreground"
                />
              )}
              <button
                className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-start"
                onClick={() => setSelected(b.id)}
              >
                <TypeIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">
                  {fixed ? `${label} ${i + 1}` : label}
                </span>
                <span className="truncate text-muted-foreground">
                  {summary(b)}
                </span>
              </button>
              {!frozen && (
                <>
                  <Tip label="Move up">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="Move up"
                      disabled={i === 0}
                      onClick={() => edit((t) => nudgeBlock(t, b.id, -1))}
                    >
                      <ArrowUp />
                    </Button>
                  </Tip>
                  <Tip label="Move down">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="Move down"
                      disabled={i === list.length - 1}
                      onClick={() => edit((t) => nudgeBlock(t, b.id, 1))}
                    >
                      <ArrowDown />
                    </Button>
                  </Tip>
                  <Tip label="Delete">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="Delete"
                      onClick={() => remove(b.id)}
                    >
                      <Trash2 />
                    </Button>
                  </Tip>
                </>
              )}
            </div>
            {isContainer(b) &&
              b.children.length > 0 &&
              renderTree(b.children, b)}
          </li>
        )
      })}
    </ol>
  )

  return (
    // The whole layout is the Tabs root so the header's tab list stays linked to the panels in <main>.
    <Tabs
      value={view}
      onValueChange={(v) => setView(v as View)}
      className="grid h-svh grid-rows-[auto_1fr] gap-0"
    >
      <header className="relative flex flex-wrap items-center gap-2 border-b px-4 py-2">
        {/* Side panels only exist in Canvas; Edit, Preview and Code use the full width. */}
        {sidePanels && (
          <Tip
            label={showBlocks ? "Hide blocks panel" : "Show blocks panel"}
            side="bottom"
          >
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={
                showBlocks ? "Hide blocks panel" : "Show blocks panel"
              }
              aria-pressed={showBlocks}
              onClick={() => setShowBlocks((s) => !s)}
            >
              {showBlocks ? <PanelLeftClose /> : <PanelLeftOpen />}
            </Button>
          </Tip>
        )}
        <h1 className="font-medium">Email builder</h1>
        {/* Centered on wide screens; inline after the title where the sides would collide. */}
        <TabsList className="ms-2 xl:absolute xl:left-1/2 xl:ms-0 xl:-translate-x-1/2">
          {VIEWS.map(({ id, label, icon: ViewIcon, tip }) => (
            <Tip key={id} label={tip} side="bottom">
              <TabsTrigger value={id} className="gap-1.5 px-2.5">
                <ViewIcon />
                <span className="max-sm:sr-only">{label}</span>
              </TabsTrigger>
            </Tip>
          ))}
        </TabsList>
        <span role="status" className="ms-auto text-sm text-muted-foreground">
          {msg}
        </span>
        <div className="flex items-center">
          <Tip label="Undo (Ctrl+Z)" side="bottom">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Undo"
              disabled={!history.canUndo}
              onClick={history.undo}
            >
              <Undo2 />
            </Button>
          </Tip>
          <Tip label="Redo (Ctrl+Shift+Z)" side="bottom">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Redo"
              disabled={!history.canRedo}
              onClick={history.redo}
            >
              <Redo2 />
            </Button>
          </Tip>
          <ThemeToggle />
          <SettingsDialog />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
            File
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => fileRef.current?.click()}>
              Import JSON, MJML, HTML or Markdown…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Copy</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => copyText(html, "HTML")}>
                HTML
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copyText(mjml, "MJML")}>
                MJML
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => copyText(toMarkdown(doc), "Markdown")}
              >
                Markdown
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Download</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => save("email.html", html, "text/html")}
              >
                email.html
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => save("email.mjml", mjml, "text/plain")}
              >
                email.mjml
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  save("email.md", toMarkdown(doc), "text/markdown")
                }
              >
                email.md
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  save(
                    "email.json",
                    JSON.stringify(doc, null, 2) + "\n",
                    "application/json"
                  )
                }
              >
                email.json
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.mjml,.html,.htm,.md,.markdown"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ""
            if (f) importFile(f)
          }}
        />
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            setAsk({
              title: "Clear this email?",
              run: () => load(EMPTY, "Cleared"),
            })
          }}
        >
          Reset
        </Button>
        {sidePanels && (
          <Tip
            label={
              showProps ? "Hide properties panel" : "Show properties panel"
            }
            side="bottom"
          >
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={
                showProps ? "Hide properties panel" : "Show properties panel"
              }
              aria-pressed={showProps}
              onClick={() => setShowProps((s) => !s)}
            >
              {showProps ? <PanelRightClose /> : <PanelRightOpen />}
            </Button>
          </Tip>
        )}
      </header>

      <div className="flex min-h-0 flex-col overflow-auto lg:flex-row lg:overflow-hidden">
        {sidePanels && showBlocks && (
          <Tabs
            render={<aside />}
            value={leftTab}
            onValueChange={(v) => setLeftTab(String(v))}
            className="min-h-0 gap-0 border-e lg:w-[300px] lg:shrink-0"
          >
            <TabsList
              variant="line"
              className="h-10 w-full shrink-0 border-b px-2"
            >
              <Tip label="Blocks" side="bottom">
                <TabsTrigger value="library">
                  <Blocks />
                  <span className="sr-only">Blocks</span>
                </TabsTrigger>
              </Tip>
              <Tip label="Templates" side="bottom">
                <TabsTrigger value="templates">
                  <LayoutTemplate />
                  <span className="sr-only">Templates</span>
                </TabsTrigger>
              </Tip>
              <Tip label="Layouts" side="bottom">
                <TabsTrigger value="layouts">
                  <PanelsTopLeft />
                  <span className="sr-only">Layouts</span>
                </TabsTrigger>
              </Tip>
              <Tip label="Layers" side="bottom">
                <TabsTrigger value="layers">
                  <Layers />
                  <span className="sr-only">Layers</span>
                  {layerCount > 0 && (
                    <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
                      {layerCount}
                    </span>
                  )}
                </TabsTrigger>
              </Tip>
            </TabsList>
            <TabsContent
              value="library"
              className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4"
            >
              {PALETTE.map(([group, items]) => (
                <section key={group} className="flex flex-col gap-0.5">
                  <h2 className="mb-1 text-xs font-medium text-muted-foreground uppercase">
                    {group}
                  </h2>
                  {items.map((item) => {
                    const ItemIcon = item.icon ?? TYPES[item.type].icon
                    const label = item.label ?? TYPES[item.type].label
                    return (
                      <Button
                        key={label}
                        variant="ghost"
                        className="cursor-grab justify-start gap-2.5 font-normal"
                        draggable
                        onDragStart={(e) =>
                          startDrag(e, { type: item.type, cols: item.cols })
                        }
                        onClick={() => add(item)}
                      >
                        <ItemIcon className="text-muted-foreground" />
                        {label}
                      </Button>
                    )
                  })}
                </section>
              ))}
            </TabsContent>
            <TabsContent
              value="templates"
              className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4"
            >
              <Templates
                onTemplate={(id) => {
                  const t = THEMED.find((x) => x.id === id)
                  if (t)
                    setAsk({
                      title: `Replace this email with "${t.theme.name} ${t.name}"?`,
                      run: () => load(t.build(), `Loaded ${t.name}`),
                    })
                }}
              />
            </TabsContent>
            <TabsContent
              value="layouts"
              className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4"
            >
              <Layouts
                layout={doc.settings.layout}
                onLayout={(id, replace) => {
                  const l = LAYOUTS.find((x) => x.id === id)
                  if (!l) return
                  const run = () =>
                    load(applyLayout(doc, id, replace), `Layout: ${l.name}`)
                  if (replace)
                    setAsk({
                      title: `Start over with "${l.name}" and sample content?`,
                      run,
                    })
                  else run()
                }}
                onDetach={() =>
                  load(
                    detachLayout(doc),
                    "Layout detached; everything is editable"
                  )
                }
              />
            </TabsContent>
            <TabsContent
              value="layers"
              className="min-h-0 overflow-y-auto p-4"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => dropHere(e, null, "inside")}
            >
              {doc.blocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No blocks yet.{" "}
                  <button
                    className="underline underline-offset-2 hover:text-foreground"
                    onClick={() => setLeftTab("library")}
                  >
                    Add one from Blocks
                  </button>
                  .
                </p>
              ) : (
                renderTree(doc.blocks, null)
              )}
            </TabsContent>
          </Tabs>
        )}

        <main className="flex min-h-[60svh] flex-1 flex-col overflow-hidden bg-muted">
          <TabsContent value="code" className="flex min-h-0 flex-col">
            {isMobile ? (
              <CodeView doc={doc} html={html} onApply={applyCode} />
            ) : (
              <ResizablePanelGroup orientation="horizontal" className="min-h-0">
                <ResizablePanel defaultSize="55" minSize="30">
                  <div className="flex size-full min-h-0 flex-col">
                    <CodeView doc={doc} html={html} onApply={applyCode} />
                  </div>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize="45" minSize="25">
                  <div className="size-full p-4 ps-3">
                    <iframe
                      title="Live preview"
                      srcDoc={html}
                      sandbox=""
                      className="size-full rounded-lg"
                    />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
          </TabsContent>
          {view !== "code" && (
            <div
              role="tabpanel"
              aria-label={VIEWS.find((v) => v.id === view)?.label}
              className="flex min-h-0 flex-1 flex-col gap-3 p-6"
            >
              <div
                role="group"
                aria-label="Preview width"
                className="flex items-center gap-0.5 self-center rounded-lg border bg-background p-0.5"
              >
                {[
                  { label: "Desktop", v: "fill", icon: <Monitor /> },
                  {
                    label: `Mobile (${MOBILE_W}px)`,
                    v: String(MOBILE_W),
                    icon: <Smartphone />,
                  },
                ].map(({ label, v, icon }) => (
                  <Tip key={v} label={label} side="bottom">
                    <Button
                      size="icon-sm"
                      variant={preset === v ? "secondary" : "ghost"}
                      aria-label={label}
                      aria-pressed={preset === v}
                      onClick={() => applyPreset(v)}
                    >
                      {icon}
                    </Button>
                  </Tip>
                ))}
                <DropdownMenu>
                  <Tip label="More sizes" side="bottom">
                    <DropdownMenuTrigger
                      render={
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="More sizes"
                        />
                      }
                    >
                      <ChevronDown />
                    </DropdownMenuTrigger>
                  </Tip>
                  <DropdownMenuContent
                    align="end"
                    className="w-56"
                    finalFocus={() => {
                      if (!focusCustom.current) return true
                      focusCustom.current = false
                      return widthRef.current
                    }}
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Preview width</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={preset}
                        onValueChange={applyPreset}
                      >
                        {BREAKPOINTS.map(({ label, w, icon: BpIcon }) => (
                          <DropdownMenuRadioItem
                            key={label}
                            value={w === null ? "fill" : String(w)}
                          >
                            <BpIcon className="text-muted-foreground" />
                            {label}
                            <span className="ms-auto text-xs text-muted-foreground tabular-nums">
                              {w === null ? "Fill" : `${w}px`}
                            </span>
                          </DropdownMenuRadioItem>
                        ))}
                        <DropdownMenuRadioItem value="custom">
                          <Ruler className="text-muted-foreground" />
                          Custom…
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="flex items-center gap-1 ps-1 pe-0.5 text-xs text-muted-foreground">
                  <PxInput
                    ref={widthRef}
                    label="Preview width in pixels (empty to fill)"
                    tip="Width (px). Empty fills the area."
                    value={size?.w}
                    min={280}
                    onCommit={setWidth}
                  />
                  ×
                  <PxInput
                    label="Preview height in pixels (empty for full height)"
                    tip="Height (px). Empty uses full height."
                    value={size?.h}
                    min={200}
                    onCommit={setHeight}
                  />
                </div>
              </div>
              {view === "edit" && (
                // Envelope fields, like an email client's compose window.
                <div className="mx-auto flex w-full max-w-3xl flex-col divide-y rounded-lg border bg-background text-sm">
                  {(
                    [
                      ["subject", "Subject", "What the inbox shows first"],
                      [
                        "preview",
                        "Preheader",
                        "The line shown after the subject",
                      ],
                    ] as const
                  ).map(([key, label, hint]) => (
                    <label
                      key={key}
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <span className="w-20 shrink-0 text-muted-foreground">
                        {label}
                      </span>
                      <input
                        value={doc.settings[key]}
                        placeholder={hint}
                        onChange={(e) => setSetting(key, e.target.value)}
                        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/60"
                      />
                    </label>
                  ))}
                </div>
              )}
              <div className="flex min-h-0 flex-1 items-center justify-center">
                <div
                  ref={frameRef}
                  className={cn(
                    "relative size-full max-h-full max-w-full",
                    // A phone frame for narrow previews.
                    view === "preview" &&
                      size &&
                      size.w <= 430 &&
                      "overflow-hidden rounded-[2.5rem] border-[10px] border-neutral-900 shadow-xl"
                  )}
                  style={size ? { width: size.w, height: size.h } : undefined}
                >
                  {view === "preview" ? (
                    // Exactly what's exported: no edit markup, no scripts, links don't navigate away.
                    <iframe
                      title="Email preview (read-only)"
                      srcDoc={html}
                      sandbox=""
                      className="size-full rounded-lg"
                    />
                  ) : (
                    <EditablePreview
                      toolbar={blockToolbar}
                      html={editableHtml}
                      selected={selected}
                      onSelect={setSelected}
                      onEdit={(id, field, value) =>
                        edit(
                          (t) => updateBlock(t, id, { [field]: value }),
                          `${id}:${field}`
                        )
                      }
                      commands={SLASH_COMMANDS}
                      onCommand={insertFromSlash}
                      onDrop={dropPayload}
                      onKey={onKey}
                      className="size-full rounded-lg"
                    />
                  )}
                  {SIDES.map((side) => {
                    const x = side === "left" || side === "right"
                    return (
                      <Tip
                        key={side}
                        side={side}
                        label="Drag to resize, double-click to reset"
                      >
                        <div
                          role="separator"
                          tabIndex={0}
                          aria-orientation={x ? "vertical" : "horizontal"}
                          aria-label={`Resize preview (${side})`}
                          onPointerDown={(e) => {
                            const r = frameRef.current!.getBoundingClientRect()
                            dragStart.current = {
                              x: e.clientX,
                              y: e.clientY,
                              w: r.width,
                              h: r.height,
                            }
                            e.currentTarget.setPointerCapture(e.pointerId)
                          }}
                          onPointerMove={(e) => {
                            const s = dragStart.current
                            if (
                              !s ||
                              !e.currentTarget.hasPointerCapture(e.pointerId)
                            )
                              return
                            const d = x ? e.clientX - s.x : e.clientY - s.y
                            setSize(
                              grow(
                                s,
                                side,
                                side === "left" || side === "top" ? -d : d
                              )
                            )
                          }}
                          onPointerUp={() => (dragStart.current = null)}
                          onDoubleClick={() => setSize(null)}
                          onKeyDown={(e) => {
                            const d = {
                              ArrowRight: 10,
                              ArrowDown: 10,
                              ArrowLeft: -10,
                              ArrowUp: -10,
                            }[e.key]
                            if (!d) return
                            e.preventDefault()
                            const r = frameRef.current!.getBoundingClientRect()
                            setSize(
                              grow(
                                { w: r.width, h: r.height },
                                side,
                                side === "left" || side === "top" ? -d : d
                              )
                            )
                          }}
                          className={cn(
                            "group absolute flex touch-none items-center justify-center outline-none",
                            x
                              ? "top-1/2 h-12 w-4 -translate-y-1/2 cursor-ew-resize"
                              : "left-1/2 h-4 w-12 -translate-x-1/2 cursor-ns-resize",
                            {
                              left: "-left-5",
                              right: "-right-5",
                              top: "-top-5",
                              bottom: "-bottom-5",
                            }[side]
                          )}
                        >
                          <span
                            className={cn(
                              "rounded-full bg-muted-foreground/60 group-hover:bg-foreground group-focus-visible:bg-ring",
                              x ? "h-8 w-1" : "h-1 w-8"
                            )}
                          />
                        </div>
                      </Tip>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          <BottomPanel
            doc={doc}
            html={html}
            onSelect={(id) => {
              setSelected(id)
              // Findings open the block's properties, which only Canvas shows.
              if (!sidePanels) setView("canvas")
              setShowProps(true)
              setLeftTab("layers")
            }}
          />
        </main>

        {sidePanels && showProps && (
          <aside className="flex flex-col gap-4 overflow-y-auto border-s p-4 lg:w-[320px] lg:shrink-0">
            {path.length > 1 && (
              <nav aria-label="Selected block path">
                <ol className="flex flex-wrap items-center gap-0.5 text-xs text-muted-foreground">
                  {path.map((b, i) => (
                    <li key={b.id} className="flex items-center gap-0.5">
                      {i > 0 && <ChevronRight aria-hidden className="size-3" />}
                      <button
                        className={cn(
                          "rounded px-1 hover:bg-muted hover:text-foreground",
                          i === path.length - 1 && "font-medium text-foreground"
                        )}
                        aria-current={
                          i === path.length - 1 ? "location" : undefined
                        }
                        onClick={() => setSelected(b.id)}
                      >
                        {TYPES[b.type].label}
                      </button>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-medium">
                {block ? TYPES[block.type].label : "Email settings"}
              </h2>
              {block ? (
                <div className="flex items-center gap-0.5">
                  {block.type !== "column" && (
                    <Tip label="Duplicate (Ctrl+D)">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Duplicate"
                        disabled={lockedAbove}
                        onClick={() => duplicate(block.id)}
                      >
                        <Copy />
                      </Button>
                    </Tip>
                  )}
                  <Tip
                    label={
                      lockedAbove
                        ? "Inside a locked block"
                        : block.locked
                          ? "Unlock"
                          : "Lock (no edits, moves or deletes)"
                    }
                  >
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={block.locked ? "Unlock" : "Lock"}
                      aria-pressed={!!block.locked}
                      disabled={lockedAbove}
                      onClick={() =>
                        edit((t) => setLocked(t, block.id, !block.locked))
                      }
                    >
                      {block.locked ? <Lock /> : <LockOpen />}
                    </Button>
                  </Tip>
                  {block.type !== "column" && (
                    <Tip label="Delete (Del)">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Delete"
                        disabled={locked}
                        onClick={() => remove(block.id)}
                      >
                        <Trash2 />
                      </Button>
                    </Tip>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelected(null)}
                  >
                    Settings
                  </Button>
                </div>
              ) : null}
            </div>
            {locked && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                {lockedAbove
                  ? "This block is inside a locked block, so it can't be edited."
                  : "This block is locked. Unlock it to edit, move or delete it."}
              </p>
            )}
            {block &&
              (TEXT_TYPES as readonly string[]).includes(block.type) && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="turn-into">Turn into</Label>
                  <Select
                    items={TEXT_TYPES.map((t) => ({
                      value: t,
                      label: TYPES[t].label,
                    }))}
                    value={block.type}
                    disabled={locked}
                    onValueChange={(v) =>
                      v &&
                      edit((t) => convertBlock(t, block.id, v as BlockType))
                    }
                  >
                    <SelectTrigger id="turn-into" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEXT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TYPES[t].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            {block?.type === "column" ? (
              <p className="text-sm text-muted-foreground">
                With this column selected, blocks you add go inside it.
              </p>
            ) : (
              <Fields
                key={block?.id ?? "settings"}
                values={block ?? doc.settings}
                disabled={locked}
                onChange={patch}
              />
            )}
          </aside>
        )}
      </div>
      <AlertDialog open={!!ask} onOpenChange={(o) => !o && setAsk(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ask?.title}</AlertDialogTitle>
            <AlertDialogDescription>You can undo this.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                ask?.run()
                setAsk(null)
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tabs>
  )
}

// A pixel field that edits a draft and applies it on Enter or blur. Empty means "auto".
function PxInput({
  ref,
  label,
  tip,
  value,
  min,
  onCommit,
}: {
  ref?: Ref<HTMLInputElement>
  label: string
  tip: string
  value?: number
  min: number
  onCommit: (px?: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const n = Number.parseInt(draft, 10)
    onCommit(Number.isFinite(n) ? Math.max(min, n) : undefined)
    setDraft(null)
  }
  return (
    <Tip label={tip} side="bottom">
      <Input
        ref={ref}
        aria-label={label}
        inputMode="numeric"
        placeholder="Auto"
        value={draft ?? (value === undefined ? "" : String(Math.round(value)))}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") setDraft(null)
        }}
        className="h-7 w-14 px-1 text-center text-xs tabular-nums md:text-xs"
      />
    </Tip>
  )
}

function ColorField({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (hex: string) => void
}) {
  // The saved doc only accepts #rrggbb, so ignore the 3-digit values HexColorInput can emit.
  const set = (hex: string) => /^#[0-9a-f]{6}$/i.test(hex) && onChange(hex)
  return (
    <Popover>
      <PopoverTrigger
        id={id}
        className="flex h-8 items-center gap-2 rounded-lg border border-input px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        <span className="size-4 rounded border" style={{ background: value }} />
        <span className="font-mono">{value}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <HexColorPicker color={value} onChange={set} />
        <HexColorInput
          color={value}
          onChange={set}
          prefixed
          aria-label="Hex color"
          className="h-8 rounded-lg border border-input bg-transparent px-2 font-mono text-sm outline-none focus-visible:border-ring dark:bg-input/30"
        />
      </PopoverContent>
    </Popover>
  )
}

const titleCase = (v: string) => v[0].toUpperCase() + v.slice(1)

function Fields({
  values,
  disabled,
  onChange,
}: {
  values: object
  disabled?: boolean
  onChange: (p: Record<string, unknown>) => void
}) {
  return (
    // A disabled fieldset disables every control inside it, including the popover and select triggers.
    <fieldset disabled={disabled} className="contents">
      {Object.entries(values)
        .filter(([k]) => !HIDDEN.has(k))
        .map(([k, v]) => {
          const id = `field-${k}`
          const set = (value: unknown) => onChange({ [k]: value })
          const kind = kindOf(k, v)
          if (kind === "boolean")
            return (
              <div key={k} className="flex items-center justify-between gap-3">
                <Label htmlFor={id}>{labelFor(k)}</Label>
                <Switch
                  id={id}
                  checked={v}
                  disabled={disabled}
                  onCheckedChange={(c) => set(c)}
                />
              </div>
            )
          const options =
            kind === "select"
              ? OPTIONS[k as keyof typeof OPTIONS].map((o) => ({
                  value: o,
                  label: titleCase(o),
                }))
              : []
          const range = RANGES[k]
          return (
            <div key={k} className="flex flex-col gap-1.5">
              <Label htmlFor={id}>{labelFor(k)}</Label>
              {kind === "number" ? (
                <div className="flex items-center gap-2">
                  {range && (
                    <input
                      type="range"
                      aria-label={labelFor(k)}
                      min={range[0]}
                      max={range[1]}
                      step={range[2]}
                      value={v}
                      onChange={(e) => set(e.target.valueAsNumber)}
                      className="min-w-0 flex-1 accent-primary"
                    />
                  )}
                  <Input
                    id={id}
                    type="number"
                    min={0}
                    step="any"
                    value={v}
                    onChange={(e) =>
                      set(Math.max(0, e.target.valueAsNumber || 0))
                    }
                    className={cn(range && "w-20")}
                  />
                </div>
              ) : kind === "color" ? (
                <ColorField id={id} value={v} onChange={set} />
              ) : kind === "select" ? (
                <Select items={options} value={v} onValueChange={set}>
                  <SelectTrigger id={id} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : kind === "body" ? (
                <>
                  <Textarea
                    id={id}
                    rows={6}
                    value={v}
                    spellCheck={k === "body" || k === "items"}
                    onChange={(e) => set(e.target.value)}
                    className={cn(
                      k !== "items" && k !== "panels" && "font-mono"
                    )}
                  />
                  {k === "networks" && (
                    <p className="text-xs text-muted-foreground">
                      Names with icons: {NETWORK_HINT}.
                    </p>
                  )}
                </>
              ) : (
                <Input
                  id={id}
                  value={v}
                  onChange={(e) => set(e.target.value)}
                />
              )}
            </div>
          )
        })}
    </fieldset>
  )
}

function Templates({ onTemplate }: { onTemplate: (id: string) => void }) {
  return (
    // Shown as a file tree: one section per email type, one file per theme.
    <Accordion>
      {TEMPLATE_TYPES.map(([type, templates = []]) => (
        <AccordionItem key={type} value={type} className="border-none">
          <AccordionTrigger className="items-center px-2 py-1.5 font-normal hover:bg-muted hover:no-underline">
            {type}
          </AccordionTrigger>
          <AccordionContent className="ms-4 flex flex-col border-s ps-2 pb-1">
            {templates.map((t) => (
              <Button
                key={t.id}
                variant="ghost"
                size="sm"
                className="justify-start gap-2 font-normal"
                onClick={() => onTemplate(t.id)}
              >
                {t.theme.name}
              </Button>
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

function Layouts({
  layout,
  onLayout,
  onDetach,
}: {
  layout: string
  onLayout: (id: string, replace: boolean) => void
  onDetach: () => void
}) {
  return (
    <>
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-muted-foreground uppercase">
            Layouts
          </h2>
          {layout && (
            <Button size="xs" variant="ghost" onClick={onDetach}>
              Detach
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          A locked header and footer around your content.
          {layout && " Switching keeps your content."}
        </p>
        {LAYOUTS.map((l) => {
          const active = layout === l.id
          return (
            <div
              key={l.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-2",
                active && "border-ring bg-muted"
              )}
            >
              {/* Mini preview: solid bars are locked regions, the dashed box is your content. */}
              <div
                aria-hidden
                className="flex h-14 w-11 shrink-0 flex-col gap-0.5 rounded border p-1"
                style={{ background: l.colors.bg }}
              >
                <span
                  className="h-2 rounded-sm"
                  style={{ background: l.colors.accent }}
                />
                <span
                  className="flex-1 rounded-sm border border-dashed"
                  style={{ borderColor: l.colors.accent }}
                />
                <span
                  className="h-1.5 rounded-sm opacity-60"
                  style={{ background: l.colors.accent }}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">{l.name}</span>
                <span className="text-xs text-muted-foreground">
                  {l.category}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  size="xs"
                  variant={active ? "secondary" : "outline"}
                  disabled={active}
                  onClick={() => onLayout(l.id, false)}
                >
                  {active ? "Active" : layout ? "Switch" : "Apply"}
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => onLayout(l.id, true)}
                >
                  Replace all
                </Button>
              </div>
            </div>
          )
        })}
      </section>
    </>
  )
}
