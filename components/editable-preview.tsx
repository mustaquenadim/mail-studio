"use client"

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
  type ReactNode,
} from "react"
import {
  Bold,
  Italic,
  Link as LinkIcon,
  Strikethrough,
  Underline,
  Unlink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tip } from "@/components/tip"
import { safeUrl } from "@/lib/email"
import { serializeRich } from "@/lib/rich"

// Drag payloads (palette items and layer-tree rows) use this dataTransfer type.
export const DRAG_TYPE = "application/x-email-block"
export type DropMode = "before" | "after" | "inside"

export type SlashCommand = {
  key: string
  label: string
  icon: ComponentType<{ className?: string }>
}

type Props = {
  html: string
  selected: string | null
  onSelect: (id: string | null) => void
  onEdit: (id: string, field: string, value: string) => void
  commands: SlashCommand[]
  // replace: the "/" was typed into an otherwise empty block, so swap that block out.
  onCommand: (key: string, blockId: string, replace: boolean) => void
  // A palette item or block dropped on the preview. targetId null = the end of the email.
  onDrop: (payload: string, targetId: string | null, mode: DropMode) => void
  // Keydowns inside the frame, for app shortcuts (they don't reach the parent window).
  onKey: (e: KeyboardEvent) => void
  // Shown just above the selected block (block actions).
  toolbar?: ReactNode
  className?: string
}

type Pos = { top: number; bottom: number; left: number; width: number }
type Bubble = Pos & { active: Record<string, boolean>; link: boolean }
type Slash = Pos & {
  query: string
  index: number
  menuLeft: number
  above: boolean
}
type SlashTarget = {
  node: Text
  start: number
  blockId: string
  field: HTMLElement
}

// Fields that hold a single line (headings, button labels): Enter is ignored there.
const SINGLE_LINE = new Set(["text"])
const BLANK = "<!DOCTYPE html><html><head></head><body></body></html>"
const FORMATS = [
  { cmd: "bold", label: "Bold", keys: "Ctrl+B", icon: Bold },
  { cmd: "italic", label: "Italic", keys: "Ctrl+I", icon: Italic },
  { cmd: "underline", label: "Underline", keys: "Ctrl+U", icon: Underline },
  { cmd: "strikeThrough", label: "Strikethrough", icon: Strikethrough },
]
const MENU_W = 224
const MENU_H = 264

const filterCommands = (commands: SlashCommand[], query: string) =>
  commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))

const editing = (d: Document) =>
  d.hasFocus() && !!(d.activeElement as HTMLElement | null)?.isContentEditable
const asElement = (n: Node | null) =>
  (n?.nodeType === 1 ? n : n?.parentElement) as Element | null | undefined
const fieldOf = (n: Node | null) =>
  asElement(n)?.closest<HTMLElement>("[data-field]") ?? null

// Patch the frame in place instead of reloading it, so scroll position survives.
// Skipped while the user is typing (or adding a link), so their caret and selection aren't lost.
function render(
  d: Document,
  html: string,
  selected: string | null,
  frozen: boolean
) {
  if (!frozen && !editing(d)) {
    const next = new DOMParser().parseFromString(html, "text/html")
    d.documentElement.replaceChildren(
      d.importNode(next.head, true),
      d.importNode(next.body, true)
    )
  }
  d.querySelectorAll("[data-selected]").forEach((el) =>
    el.removeAttribute("data-selected")
  )
  if (selected)
    d.querySelector(`[data-block="${CSS.escape(selected)}"]`)?.setAttribute(
      "data-selected",
      ""
    )
}

export function EditablePreview({ className, ...props }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const latest = useRef(props)
  useEffect(() => {
    latest.current = props
  })

  const [bubble, setBubble] = useState<Bubble | null>(null)
  const [link, setLink] = useState<{ url: string; error?: string } | null>(null)
  const [slash, setSlashState] = useState<Slash | null>(null)
  const slashRef = useRef<Slash | null>(null)
  const slashTarget = useRef<SlashTarget | null>(null)
  const savedRange = useRef<Range | null>(null)
  const frozen = useRef(false) // true while the link field (outside the frame) has focus
  const focusNew = useRef(false) // focus the newly inserted block's text after the next render

  const setSlash = (s: Slash | null) => {
    slashRef.current = s
    setSlashState(s)
  }
  const doc = () => frame.current?.contentDocument ?? null
  const attached = useRef<Document | null>(null)

  // Frame-viewport rect -> position inside our wrapper.
  const toPos = (r: DOMRect): Pos => {
    const f = frame.current!
    const dx = f.offsetLeft + f.clientLeft
    const dy = f.offsetTop + f.clientTop
    return {
      top: r.top + dy,
      bottom: r.bottom + dy,
      left: r.left + dx,
      width: r.width,
    }
  }

  // Where the selected block is, for the toolbar.
  const [selPos, setSelPos] = useState<Pos | null>(null)
  const placeToolbar = () => {
    const id = latest.current.selected
    const el = id
      ? doc()?.querySelector(`[data-block="${CSS.escape(id)}"]`)
      : null
    const pos = el ? toPos(el.getBoundingClientRect()) : null
    // Hidden while the block is scrolled out of view.
    const h = wrap.current?.clientHeight ?? Infinity
    setSelPos(pos && pos.bottom > 0 && pos.top < h ? pos : null)
  }
  const placeRef = useRef(placeToolbar)
  useEffect(() => {
    placeRef.current = placeToolbar
  })
  // The frame resizes with the preview size controls and the window.
  useEffect(() => {
    const ro = new ResizeObserver(() => placeRef.current())
    if (frame.current) ro.observe(frame.current)
    return () => ro.disconnect()
  }, [])

  const { html, selected } = props
  useEffect(() => {
    const d = doc()
    if (!d?.documentElement) return
    render(d, html, selected, frozen.current)
    if (focusNew.current && selected) {
      focusNew.current = false
      const field = d.querySelector<HTMLElement>(
        `[data-block="${CSS.escape(selected)}"] [data-field]`
      )
      if (field) {
        field.focus()
        const r = d.createRange()
        r.selectNodeContents(field)
        r.collapse(false)
        d.getSelection()?.removeAllRanges()
        d.getSelection()?.addRange(r)
      }
    }
    placeToolbar()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- placeToolbar reads refs only
  }, [html, selected])

  // --- Bubble menu (formatting the selection) ---

  const updateBubble = () => {
    const d = doc()
    if (!d || frozen.current) return
    const sel = d.getSelection()
    const range =
      sel && !sel.isCollapsed && sel.rangeCount ? sel.getRangeAt(0) : null
    const field = range && fieldOf(range.commonAncestorContainer)
    if (!range || !field?.hasAttribute("data-rich")) return setBubble(null)
    setBubble({
      ...toPos(range.getBoundingClientRect()),
      active: Object.fromEntries(
        FORMATS.map((f) => [f.cmd, d.queryCommandState(f.cmd)])
      ),
      link: !!asElement(range.commonAncestorContainer)?.closest("a"),
    })
  }

  // ponytail: execCommand is deprecated but still the only built-in way to format a contenteditable selection
  // in every browser; it also fires "input", which is what saves the edit.
  const format = (cmd: string) => {
    doc()?.execCommand(cmd)
    updateBubble()
  }

  const startLink = () => {
    const d = doc()
    const sel = d?.getSelection()
    if (!d || !sel?.rangeCount) return
    if (bubble?.link) return format("unlink")
    savedRange.current = sel.getRangeAt(0).cloneRange()
    frozen.current = true
    setLink({ url: "" })
  }

  const endLink = (url?: string) => {
    const d = doc()
    const range = savedRange.current
    frozen.current = false
    setLink(null)
    if (!d || !range) return
    frame.current?.contentWindow?.focus()
    const sel = d.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    if (url) d.execCommand("createLink", false, url)
    updateBubble()
  }

  const submitLink = (e: FormEvent) => {
    e.preventDefault()
    const url = link?.url.trim() ?? ""
    if (!safeUrl(url))
      return setLink({ url, error: "Use a full https:// or mailto: link." })
    endLink(url)
  }

  // --- Slash menu (inserting blocks) ---

  const matches = (query: string) =>
    filterCommands(latest.current.commands, query)

  const detectSlash = (d: Document, field: HTMLElement) => {
    const sel = d.getSelection()
    const range = sel?.isCollapsed && sel.rangeCount ? sel.getRangeAt(0) : null
    const node = range?.startContainer
    const blockId = field.closest<HTMLElement>("[data-block]")?.dataset.block
    if (!range || node?.nodeType !== 3 || !blockId) return setSlash(null)
    const before = (node.textContent ?? "").slice(0, range.startOffset)
    const m = before.match(/(?:^|\s)\/([^\s/]{0,24})$/)
    if (!m || !matches(m[1]).length) return setSlash(null)
    const start = range.startOffset - m[1].length - 1
    const r = d.createRange()
    r.setStart(node, start)
    r.setEnd(node, range.startOffset)
    slashTarget.current = { node: node as Text, start, blockId, field }
    const prev = slashRef.current
    const pos = toPos(r.getBoundingClientRect())
    // Keep the menu inside the preview: clamp sideways, and flip above the caret near the bottom.
    const box = wrap.current?.getBoundingClientRect()
    setSlash({
      ...pos,
      menuLeft: Math.max(4, Math.min(pos.left, (box?.width ?? 0) - MENU_W - 4)),
      above: !!box && pos.bottom + MENU_H > box.height,
      query: m[1],
      index: prev && prev.query === m[1] ? prev.index : 0,
    })
  }

  const choose = (cmd: SlashCommand) => {
    const d = doc()
    const t = slashTarget.current
    const s = slashRef.current
    setSlash(null)
    if (!d || !t || !s) return
    // Remove the "/query" text, then insert (or swap in) the chosen block.
    const r = d.createRange()
    r.setStart(t.node, t.start)
    r.setEnd(t.node, Math.min(t.node.length, t.start + 1 + s.query.length))
    const sel = d.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(r)
    d.execCommand("delete")
    const empty = !t.field.textContent?.trim()
    ;(d.activeElement as HTMLElement | null)?.blur()
    focusNew.current = true
    latest.current.onCommand(cmd.key, t.blockId, empty)
  }

  // --- Drag and drop ---

  // Where a drop at this point would go: inside an empty container, else before/after the block under it.
  const dropTarget = (d: Document, e: DragEvent) => {
    const el = (e.target as Element | null)?.closest?.<HTMLElement>(
      "[data-block]"
    )
    if (!el) return null
    const empty =
      el.hasAttribute("data-container") && !el.querySelector("[data-block]")
    const r = el.getBoundingClientRect()
    const mode: DropMode = empty
      ? "inside"
      : e.clientY < r.top + r.height / 2
        ? "before"
        : "after"
    return { el, mode }
  }
  const clearDrop = (d: Document) =>
    d
      .querySelectorAll(
        "[data-drop-before],[data-drop-after],[data-drop-inside]"
      )
      .forEach((el) => {
        el.removeAttribute("data-drop-before")
        el.removeAttribute("data-drop-after")
        el.removeAttribute("data-drop-inside")
      })

  // --- Frame events ---

  const listen = (d: Document) => {
    // Canvas mode: blocks carry draggable="true"; dragging one moves it.
    d.addEventListener("dragstart", (e) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(
        "[data-block][draggable=true]"
      )
      if (!el || !e.dataTransfer) return
      e.dataTransfer.setData(
        DRAG_TYPE,
        JSON.stringify({ id: el.dataset.block })
      )
      e.dataTransfer.effectAllowed = "move"
    })
    d.addEventListener("dragover", (e) => {
      if (!e.dataTransfer?.types.includes(DRAG_TYPE)) return
      e.preventDefault()
      clearDrop(d)
      const t = dropTarget(d, e)
      t?.el.setAttribute(`data-drop-${t.mode}`, "")
    })
    d.addEventListener("dragleave", (e) => {
      if (!e.relatedTarget) clearDrop(d)
    })
    d.addEventListener("drop", (e) => {
      const payload = e.dataTransfer?.getData(DRAG_TYPE)
      clearDrop(d)
      if (!payload) return
      e.preventDefault()
      const t = dropTarget(d, e)
      latest.current.onDrop(
        payload,
        t?.el.dataset.block ?? null,
        t?.mode ?? "inside"
      )
    })

    d.execCommand("styleWithCSS", false, "false") // <b>/<i> tags, not inline styles

    d.addEventListener("click", (e) => {
      const t = e.target as Element
      // Links would navigate the preview frame away from the email.
      if (t.closest("a")) e.preventDefault()
      setSlash(null)
      const block = t.closest<HTMLElement>("[data-block]")
      latest.current.onSelect(block?.dataset.block ?? null)
    })

    d.addEventListener("input", (e) => {
      const field = fieldOf(e.target as Node)
      const id = field?.closest<HTMLElement>("[data-block]")?.dataset.block
      const name = field?.dataset.field
      if (!field || !id || !name) return
      const isRich = field.hasAttribute("data-rich")
      // innerText turns <br> into newlines; browsers may add one trailing newline.
      let value = isRich
        ? serializeRich(field, safeUrl)
        : field.innerText.replace(/\n$/, "")
      if (SINGLE_LINE.has(name)) value = value.replace(/\n/g, " ")
      latest.current.onEdit(id, name, value)
      if (isRich) detectSlash(d, field)
    })

    d.addEventListener("keydown", (e) => {
      const s = slashRef.current
      if (s) {
        const items = matches(s.query)
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault()
          const step = e.key === "ArrowDown" ? 1 : -1
          setSlash({
            ...s,
            index: (s.index + step + items.length) % items.length,
          })
          return
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault()
          if (items[s.index]) choose(items[s.index])
          return
        }
        if (e.key === "Escape") {
          e.preventDefault()
          setSlash(null)
          return
        }
      }
      const field = fieldOf(e.target as Node)
      const name = field?.dataset.field
      if (e.key === "Enter" && name) {
        if (SINGLE_LINE.has(name)) e.preventDefault()
        // Lists keep the browser's Enter (new item); other rich text gets a plain line break.
        else if (field.hasAttribute("data-rich") && name !== "items") {
          e.preventDefault()
          d.execCommand("insertLineBreak")
        }
      }
      if (e.key === "Escape") (e.target as HTMLElement).blur?.()
      latest.current.onKey(e)
    })

    // Paste as plain text so outside markup never enters the email.
    d.addEventListener("paste", (e) => {
      const field = fieldOf(e.target as Node)
      if (!field?.hasAttribute("data-rich")) return
      e.preventDefault()
      let text = e.clipboardData?.getData("text/plain") ?? ""
      if (SINGLE_LINE.has(field.dataset.field ?? ""))
        text = text.replace(/\s*\n\s*/g, " ")
      d.execCommand("insertText", false, text)
    })

    d.addEventListener("selectionchange", updateBubble)
    d.addEventListener("scroll", () => placeRef.current())
    d.addEventListener("scroll", () => {
      setSlash(null)
      setBubble(null)
    })

    // Once focus settles outside the text, redraw so edits are normalized (e.g. list items).
    d.addEventListener("focusout", () =>
      setTimeout(() => {
        if (!editing(d)) setSlash(null)
        render(d, latest.current.html, latest.current.selected, frozen.current)
      })
    )
  }

  // Once per srcdoc document. The frame can finish loading before React hydrates and misses
  // onLoad, so the mount effect below attaches too.
  const attach = () => {
    const d = doc()
    if (!d || d === attached.current || d.location.href !== "about:srcdoc")
      return
    attached.current = d
    listen(d)
    render(d, latest.current.html, latest.current.selected, false)
  }
  const attachRef = useRef(attach)
  useEffect(() => {
    if (doc()?.readyState === "complete") attachRef.current()
  }, [])

  const items = slash ? filterCommands(props.commands, slash.query) : []

  return (
    <div ref={wrap} className="relative size-full">
      {/* allow-same-origin (without allow-scripts) lets this page edit the frame's DOM,
          while the email itself still can't run scripts, open popups or navigate. */}
      <iframe
        ref={frame}
        title="Email preview. Click text to edit it, select text to format it, or type / to add a block."
        srcDoc={BLANK}
        sandbox="allow-same-origin"
        onLoad={attach}
        className={className}
      />

      {props.toolbar && selPos && (
        <div
          className="absolute z-10 -translate-y-full pb-1"
          style={{ top: Math.max(selPos.top, 32), left: selPos.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {props.toolbar}
        </div>
      )}

      {bubble && (
        <div
          role="toolbar"
          aria-label="Format text"
          className="absolute z-20 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
          style={{ top: bubble.top - 6, left: bubble.left + bubble.width / 2 }}
          // Keep focus (and the selection) in the frame while clicking buttons.
          onMouseDown={(e) => !link && e.preventDefault()}
        >
          {link ? (
            <form onSubmit={submitLink} className="flex items-center gap-1">
              <Input
                autoFocus
                aria-label="Link URL"
                aria-invalid={!!link.error}
                placeholder="https://"
                value={link.url}
                onChange={(e) => setLink({ url: e.target.value })}
                onKeyDown={(e) => e.key === "Escape" && endLink()}
                className="h-7 w-56 text-xs md:text-xs"
              />
              <Button type="submit" size="sm">
                Add
              </Button>
              {link.error && (
                <span role="alert" className="sr-only">
                  {link.error}
                </span>
              )}
            </form>
          ) : (
            <>
              {FORMATS.map(({ cmd, label, keys, icon: Icon }) => (
                <Tip
                  key={cmd}
                  label={keys ? `${label} (${keys})` : label}
                  side="top"
                >
                  <Button
                    size="icon-xs"
                    variant={bubble.active[cmd] ? "secondary" : "ghost"}
                    aria-label={label}
                    aria-pressed={bubble.active[cmd]}
                    onClick={() => format(cmd)}
                  >
                    <Icon />
                  </Button>
                </Tip>
              ))}
              <span className="mx-0.5 h-4 w-px bg-border" />
              <Tip label={bubble.link ? "Remove link" : "Add link"} side="top">
                <Button
                  size="icon-xs"
                  variant={bubble.link ? "secondary" : "ghost"}
                  aria-label={bubble.link ? "Remove link" : "Add link"}
                  onClick={startLink}
                >
                  {bubble.link ? <Unlink /> : <LinkIcon />}
                </Button>
              </Tip>
            </>
          )}
        </div>
      )}
      {link?.error && bubble && (
        <p
          className="absolute z-20 -translate-x-1/2 rounded-md bg-destructive px-2 py-1 text-xs text-white"
          style={{ top: bubble.top + 4, left: bubble.left + bubble.width / 2 }}
        >
          {link.error}
        </p>
      )}

      {slash && items.length > 0 && (
        <div
          role="listbox"
          aria-label="Insert block"
          className={cn(
            "absolute z-20 overflow-y-auto rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md",
            slash.above && "-translate-y-full"
          )}
          style={{
            width: MENU_W,
            maxHeight: MENU_H,
            top: slash.above ? slash.top - 4 : slash.bottom + 4,
            left: slash.menuLeft,
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <p className="px-2 py-1 text-xs text-muted-foreground">
            {slash.query ? `Blocks matching "${slash.query}"` : "Insert block"}
          </p>
          {items.map((c, i) => (
            <div
              key={c.key}
              role="option"
              aria-selected={i === slash.index}
              onClick={() => choose(c)}
              onMouseEnter={() => setSlash({ ...slash, index: i })}
              className={cn(
                "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5",
                i === slash.index && "bg-accent text-accent-foreground"
              )}
            >
              <c.icon className="size-4 text-muted-foreground" />
              {c.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
