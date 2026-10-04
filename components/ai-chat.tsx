"use client"

// Chat-style AI panel for the Edit view: each message generates a new email, or edits the
// current one once it has blocks. Messages live for the session only.
import { useEffect, useRef, useState } from "react"
import {
  ArrowUp,
  CircleCheck,
  Copy,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react"
import type { EmailDoc } from "@/lib/model"
import { useEditorPrefs } from "@/lib/editor-prefs"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { Tip } from "@/components/tip"

type Prefs = ReturnType<typeof useEditorPrefs>

// POST /api/generate. `doc` set = edit that email; returns the new doc and the model's note.
export async function generateEmail(
  prompt: string,
  doc: EmailDoc | undefined,
  prefs: Prefs
): Promise<{ doc: EmailDoc; reply?: string } | { error: string }> {
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt,
        doc,
        apiKey: prefs.aiKey || undefined,
        model: prefs.aiModel,
      }),
    })
    const data = await res.json()
    return res.ok ? data : { error: data.error ?? "Generation failed" }
  } catch {
    return { error: "Generation failed: network error" }
  }
}

type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; version: number; edited: boolean }
  | { role: "error"; text: string }

const STARTERS = [
  "Product launch announcement",
  "Weekly newsletter",
  "Welcome email for new users",
]
const FOLLOW_UPS = [
  "Make it dark mode",
  "Shorten the copy",
  "Add a footer with social links",
  "Make the CTA stand out",
]

export function AiChat({
  current,
  onDoc,
}: {
  current: EmailDoc
  // Returns an error message when the doc can't be applied.
  onDoc: (d: EmailDoc, edit: boolean) => string | null | void
}) {
  const prefs = useEditorPrefs()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [showTips, setShowTips] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)
  const hasContent = current.blocks.length > 0
  const versions = msgs.filter((m) => m.role === "assistant").length

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [msgs, busy])

  const send = async (text: string) => {
    const prompt = text.trim()
    if (!prompt || busy) return
    setInput("")
    setMsgs((m) => [...m, { role: "user", text: prompt }])
    setBusy(true)
    const edit = hasContent
    const res = await generateEmail(prompt, edit ? current : undefined, prefs)
    const err = "error" in res ? res.error : onDoc(res.doc, edit)
    setMsgs((m) => [
      ...m,
      err
        ? { role: "error", text: err }
        : {
            role: "assistant",
            text:
              ("reply" in res && res.reply) ||
              (edit ? "Updated the email." : "Generated the email."),
            version: versions + 1,
            edited: edit,
          },
    ])
    setBusy(false)
  }
  const lastPrompt = msgs.findLast((m) => m.role === "user")?.text

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {msgs.length === 0 && (
          <div className="m-auto flex max-w-56 flex-col items-center gap-2 text-center">
            <Sparkles className="size-5 text-muted-foreground" />
            <h2 className="font-medium">Generate with AI</h2>
            <p className="text-xs text-muted-foreground">
              {hasContent
                ? "Describe a change and it's applied to the current email."
                : "Describe the email you want and it's built for you."}
            </p>
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <Bubble key={i} align="end" variant="secondary">
              <BubbleContent className="whitespace-pre-wrap">
                {m.text}
              </BubbleContent>
            </Bubble>
          ) : m.role === "error" ? (
            <Bubble key={i} variant="destructive">
              <BubbleContent>{m.text}</BubbleContent>
            </Bubble>
          ) : (
            <div key={i} className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
                <span className="flex items-center gap-2">
                  <CircleCheck className="size-4 text-muted-foreground" />
                  Version {m.version}
                </span>
                <span className="text-xs text-muted-foreground">
                  {m.version === versions ? "Latest · " : ""}
                  {m.edited ? "Edited" : "Generated"}
                </span>
              </div>
              <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
              <div className="flex gap-0.5 text-muted-foreground">
                <Tip label="Copy">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Copy"
                    onClick={() => navigator.clipboard.writeText(m.text)}
                  >
                    <Copy />
                  </Button>
                </Tip>
              </div>
            </div>
          )
        )}
        {busy && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> {hasContent ? "Editing…" : "Generating…"}
          </p>
        )}
        {!busy && msgs.at(-1)?.role === "error" && lastPrompt && (
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            onClick={() => send(lastPrompt)}
          >
            <RotateCcw /> Retry
          </Button>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex flex-col gap-2 border-t p-3">
        {showTips && !busy && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              Suggestions
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label="Hide suggestions"
                onClick={() => setShowTips(false)}
              >
                <X />
              </Button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {(hasContent ? FOLLOW_UPS : STARTERS).map((s) => (
                <Button
                  key={s}
                  size="xs"
                  variant="outline"
                  className="shrink-0 rounded-full"
                  onClick={() => send(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}
        <InputGroup>
          <InputGroupTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault()
                send(input)
              }
            }}
            placeholder={
              hasContent ? "Ask for a change…" : "Describe your email…"
            }
            rows={3}
            className="max-h-40"
            disabled={busy}
          />
          <InputGroupAddon align="block-end" className="justify-end">
            <InputGroupButton
              size="icon-xs"
              variant="default"
              className="rounded-full"
              aria-label="Send"
              disabled={busy || !input.trim()}
              onClick={() => send(input)}
            >
              <ArrowUp />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <p className="text-center text-xs text-muted-foreground">
          AI can make mistakes. Check the email before sending.
        </p>
      </div>
    </div>
  )
}
