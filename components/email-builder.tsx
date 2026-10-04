"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type Ref,
} from "react"
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Ruler,
  Laptop,
  Smartphone,
  Tablet,
  CodeXml,
  Columns2,
  Columns3,
  Columns4,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  List,
  ListOrdered,
  Monitor,
  MousePointer2,
  MoveVertical,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RectangleVertical,
  Rows2,
  SeparatorHorizontal,
  SquareCode,
  TextQuote,
  Trash2,
} from "lucide-react"
import { HexColorInput, HexColorPicker } from "react-colorful"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { CodeView } from "@/components/code-view"
import { BottomPanel } from "@/components/bottom-panel"
import {
  EditablePreview,
  type SlashCommand,
} from "@/components/editable-preview"
import { allBlocks } from "@/lib/checks"
import { plainText } from "@/lib/rich"
import { Tip } from "@/components/tip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import {
  DEFAULT_SETTINGS,
  findBlock,
  insertBlock,
  isContainer,
  kindOf,
  moveBlock,
  newBlock,
  nudgeBlock,
  parseDoc,
  removeBlock,
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

const KEY = "email-builder:doc"
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
    ],
  ],
  ["Media", [{ type: "image" }]],
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
}
const ALIGN_ITEMS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
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
            : ""

export function EmailBuilder() {
  const [doc, setDoc] = useState<EmailDoc>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [msg, setMsg] = useState("")
  const [showBlocks, setShowBlocks] = useState(true)
  const [showProps, setShowProps] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef<(Size & { x: number; y: number }) | null>(null)
  // null = fill the preview area.
  const [size, setSize] = useState<PreviewSize | null>(null)
  const [view, setView] = useState("preview")
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from browser storage
      if (d) setDoc(d)
      // Keep an unreadable draft instead of overwriting it with an empty one.
      else if (raw) localStorage.setItem(`${KEY}:unreadable`, raw)
    } catch {}
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(KEY, JSON.stringify(doc))
    } catch {}
  }, [doc, loaded])

  const html = useMemo(() => toHtml(doc), [doc])
  const editableHtml = useMemo(() => toEditableHtml(doc), [doc])
  const block = findBlock(doc.blocks, selected)
  // Columns inside a columns block aren't added by hand, so they don't count.
  const addedCount = allBlocks(doc.blocks).filter(
    (b) => b.type !== "column"
  ).length

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(""), 2500)
  }
  const edit = (f: (tree: Block[]) => Block[]) =>
    setDoc((d) => ({ ...d, blocks: f(d.blocks) }))

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
  // Dropping on a container puts the block inside it; otherwise it goes before the target.
  const drop = (targetId: string) => {
    if (!dragId) return
    edit((tree) => {
      const inside = moveBlock(tree, dragId, targetId, "inside")
      return inside !== tree
        ? inside
        : moveBlock(tree, dragId, targetId, "before")
    })
    setDragId(null)
  }
  const remove = (id: string) => {
    edit((tree) => removeBlock(tree, id))
    if (selected === id) setSelected(null)
  }
  const patch = (p: Record<string, unknown>) =>
    block
      ? edit((tree) => updateBlock(tree, block.id, p))
      : setDoc((d) => ({ ...d, settings: { ...d.settings, ...p } }))

  const importFile = async (file: File) => {
    const d = parseDoc(await file.text())
    if (!d) return flash("Import failed: not a valid email JSON file")
    setDoc(d)
    setSelected(null)
    flash("Imported")
  }

  const renderTree = (list: Block[], parent: Block | null) => (
    <ol
      className={cn("flex flex-col gap-1", parent && "ms-3 mt-1 border-s ps-2")}
    >
      {list.map((b, i) => {
        const { icon: TypeIcon, label } = TYPES[b.type]
        // Columns are fixed by their parent: no drag, reorder or delete.
        const fixed = b.type === "column"
        return (
          <li key={b.id}>
            <div
              draggable={!fixed}
              onDragStart={(e) => {
                e.stopPropagation()
                setDragId(b.id)
              }}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.stopPropagation()
                drop(b.id)
              }}
              className={cn(
                "flex items-center gap-1 rounded-lg border p-1 text-sm",
                selected === b.id && "border-ring bg-muted",
                dragId === b.id && "opacity-50"
              )}
            >
              {fixed ? (
                <span className="size-4 shrink-0" />
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
              {!fixed && (
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
      onValueChange={(v) => setView(String(v))}
      className="grid h-svh grid-rows-[auto_1fr] gap-0"
    >
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <Tip
          label={showBlocks ? "Hide blocks panel" : "Show blocks panel"}
          side="bottom"
        >
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={showBlocks ? "Hide blocks panel" : "Show blocks panel"}
            aria-pressed={showBlocks}
            onClick={() => setShowBlocks((s) => !s)}
          >
            {showBlocks ? <PanelLeftClose /> : <PanelLeftOpen />}
          </Button>
        </Tip>
        <h1 className="font-medium">Email builder</h1>
        <TabsList className="ms-2">
          <Tip label="Preview" side="bottom">
            <TabsTrigger value="preview" aria-label="Preview">
              <Monitor />
            </TabsTrigger>
          </Tip>
          <Tip label="Code" side="bottom">
            <TabsTrigger value="code" aria-label="Code">
              <CodeXml />
            </TabsTrigger>
          </Tip>
        </TabsList>
        {view === "preview" && (
          <div
            role="group"
            aria-label="Preview width"
            className="flex items-center gap-0.5 rounded-lg border p-0.5"
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
        )}
        <span role="status" className="ms-auto text-sm text-muted-foreground">
          {msg}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
        >
          Import JSON
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
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
            if (confirm("Clear this email?")) {
              setDoc(EMPTY)
              setSelected(null)
            }
          }}
        >
          Reset
        </Button>
        <Tip
          label={showProps ? "Hide properties panel" : "Show properties panel"}
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
      </header>

      <div className="flex min-h-0 flex-col overflow-auto lg:flex-row lg:overflow-hidden">
        {showBlocks && (
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
              <TabsTrigger value="library">Blocks</TabsTrigger>
              <TabsTrigger value="added">
                Added
                {addedCount > 0 && (
                  <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
                    {addedCount}
                  </span>
                )}
              </TabsTrigger>
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
                        className="justify-start gap-2.5 font-normal"
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
            <TabsContent value="added" className="min-h-0 overflow-y-auto p-4">
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
            <CodeView doc={doc} html={html} />
          </TabsContent>
          <TabsContent
            value="preview"
            className="flex min-h-0 items-center justify-center p-6"
          >
            <div
              ref={frameRef}
              className="relative size-full max-h-full max-w-full"
              style={size ? { width: size.w, height: size.h } : undefined}
            >
              <EditablePreview
                html={editableHtml}
                selected={selected}
                onSelect={setSelected}
                onEdit={(id, field, value) =>
                  edit((t) => updateBlock(t, id, { [field]: value }))
                }
                commands={SLASH_COMMANDS}
                onCommand={insertFromSlash}
                className="size-full rounded-lg border bg-white"
              />
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
          </TabsContent>
          <BottomPanel
            doc={doc}
            html={html}
            onSelect={(id) => {
              setSelected(id)
              setShowProps(true)
              setLeftTab("added")
            }}
          />
        </main>

        {showProps && (
          <aside className="flex flex-col gap-4 overflow-y-auto border-s p-4 lg:w-[320px] lg:shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">
                {block ? TYPES[block.type].label : "Email settings"}
              </h2>
              {block && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelected(null)}
                >
                  Email settings
                </Button>
              )}
            </div>
            {block?.type === "column" ? (
              <p className="text-sm text-muted-foreground">
                With this column selected, blocks you add go inside it.
              </p>
            ) : (
              <Fields
                key={block?.id ?? "settings"}
                values={block ?? doc.settings}
                onChange={patch}
              />
            )}
          </aside>
        )}
      </div>
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

function Fields({
  values,
  onChange,
}: {
  values: object
  onChange: (p: Record<string, unknown>) => void
}) {
  return Object.entries(values)
    .filter(([k]) => k !== "id" && k !== "type" && k !== "children")
    .map(([k, v]) => {
      const id = `field-${k}`
      const set = (value: unknown) => onChange({ [k]: value })
      const kind = kindOf(k, v)
      return (
        <div key={k} className="flex flex-col gap-1.5">
          <Label htmlFor={id}>{labelFor(k)}</Label>
          {kind === "number" ? (
            <Input
              id={id}
              type="number"
              min={0}
              value={v}
              onChange={(e) => set(Math.max(0, e.target.valueAsNumber || 0))}
            />
          ) : kind === "color" ? (
            <ColorField id={id} value={v} onChange={set} />
          ) : kind === "align" ? (
            <Select items={ALIGN_ITEMS} value={v} onValueChange={set}>
              <SelectTrigger id={id} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALIGN_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : kind === "body" ? (
            <Textarea
              id={id}
              rows={6}
              value={v}
              onChange={(e) => set(e.target.value)}
              className={cn(k === "body" && "font-mono")}
            />
          ) : (
            <Input id={id} value={v} onChange={(e) => set(e.target.value)} />
          )}
        </div>
      )
    })
}
