"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Check, Clipboard, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tip } from "@/components/tip"
import {
  fromHtml,
  fromMarkdown,
  fromMjml,
  toMarkdown,
  toMjml,
} from "@/lib/convert"
import {
  formatHtml,
  parseDoc,
  toReact,
  toText,
  type EmailDoc,
} from "@/lib/email"

type Format = "react" | "html" | "text" | "json" | "mjml" | "markdown"

// How each tab is applied back to the email. JSON, MJML and Markdown map onto blocks exactly;
// HTML, plain text and React come back as content only (see LOSSY).
const PARSERS: Record<
  Format,
  (src: string) => EmailDoc | null | Promise<EmailDoc | null>
> = {
  json: parseDoc,
  mjml: fromMjml,
  markdown: fromMarkdown,
  html: fromHtml,
  // Plain text reads as Markdown: paragraphs, "- " lists, "> " quotes and "---" all carry over.
  text: fromMarkdown,
  react: async (src) =>
    fromHtml(await (await import("@/components/monaco")).reactToHtml(src)),
}
const LOSSY: Partial<Record<Format, true>> = {
  html: true,
  text: true,
  react: true,
}
const LABELS: Record<Format, string> = {
  react: "React",
  html: "HTML",
  text: "Plain Text",
  json: "JSON",
  mjml: "MJML",
  markdown: "Markdown",
}

// Monaco needs the browser, so it loads on the client only.
const CodeEditor = dynamic(() => import("@/components/monaco"), {
  ssr: false,
  loading: () => (
    <p className="p-4 text-xs text-muted-foreground">Loading editor…</p>
  ),
})
const LANGUAGES: Record<Format, [language: string, path: string]> = {
  react: ["typescript", "Email.tsx"],
  html: ["html", "email.html"],
  text: ["plaintext", "email.txt"],
  json: ["json", "email.json"],
  mjml: ["xml", "email.mjml"],
  markdown: ["markdown", "email.md"],
}

export function save(name: string, text: string, type: string) {
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href))
}

// onApply returns an error message, or null when the edit was applied.
export function CodeView({
  doc,
  html,
  onApply,
}: {
  doc: EmailDoc
  html: string
  onApply: (doc: EmailDoc) => string | null
}) {
  const [format, setFormat] = useState<Format>("react")
  const [copied, setCopied] = useState(false)
  // Edited text not yet applied, or null when the editor shows the generated code.
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState("")
  const mjml = useMemo(() => toMjml(doc), [doc])
  const markdown = useMemo(() => toMarkdown(doc), [doc])
  const react = useMemo(() => toReact(doc), [doc])
  const text = useMemo(() => toText(doc), [doc])
  // The preview text's invisible padding is shown as entities (same HTML) so it's readable.
  const prettyHtml = useMemo(
    () =>
      formatHtml(html).replace(
        /[ ​-‏﻿]/g,
        (c) => `&#x${c.charCodeAt(0).toString(16).toUpperCase()};`
      ),
    [html]
  )
  // Same format as Export JSON, so it can be imported back.
  const json = useMemo(() => JSON.stringify(doc, null, 2) + "\n", [doc])

  // What each tab exports. HTML exports the exact markup, not the indented view.
  const exports = {
    react: { name: "Email.tsx", body: react, type: "text/plain" },
    html: { name: "email.html", body: html, type: "text/html" },
    text: { name: "email.txt", body: text, type: "text/plain" },
    json: { name: "email.json", body: json, type: "application/json" },
    mjml: { name: "email.mjml", body: mjml, type: "text/plain" },
    markdown: { name: "email.md", body: markdown, type: "text/markdown" },
  }[format]
  // `text` comes from Ctrl+Enter in the editor; the Apply button uses the draft.
  const apply = async (text = draft) => {
    if (text === null) return
    let d: EmailDoc | null
    try {
      d = await PARSERS[format](text)
    } catch (e) {
      return setError(
        `${LABELS[format]} error: ${e instanceof Error ? e.message : String(e)}`
      )
    }
    if (!d)
      return setError(
        `Couldn't read this ${LABELS[format]}. Check the syntax and try again.`
      )
    const err = onApply(d)
    if (err) return setError(err)
    setDraft(null)
    setError("")
  }
  const cancel = () => {
    setDraft(null)
    setError("")
  }
  const note =
    format === "html" ? " (exact markup, without the indentation)" : ""

  const copy = () =>
    navigator.clipboard.writeText(exports.body).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })

  return (
    <Tabs
      value={format}
      onValueChange={(v) => {
        setFormat(v as Format)
        cancel()
      }}
      className="min-h-0 flex-1 gap-0 overflow-hidden bg-background"
    >
      <div className="flex items-center justify-between border-b bg-muted/40 pe-2">
        <TabsList variant="line" className="h-10 px-2">
          {(Object.keys(LABELS) as Format[]).map((f) => (
            <TabsTrigger key={f} value={f} className="px-3">
              {LABELS[f]}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="flex items-center gap-1">
          {draft !== null && (
            <>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                Modified
              </span>
              <Button size="sm" variant="ghost" onClick={cancel}>
                Reset
              </Button>
              <Tip label="Apply to the email (Ctrl+Enter)" side="bottom">
                <Button size="sm" onClick={() => apply()}>
                  Apply
                </Button>
              </Tip>
            </>
          )}
          {LOSSY[format] && (
            <Tip
              label="Applying keeps the content (headings, text, lists, images, buttons) but not styling or layout. Use JSON, MJML or Markdown for exact edits."
              side="bottom"
            >
              <span className="px-2 text-xs text-muted-foreground underline decoration-dotted underline-offset-2">
                Applies content only
              </span>
            </Tip>
          )}
          <Tip label={`Download ${exports.name}${note}`} side="bottom">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Download ${exports.name}${note}`}
              onClick={() => save(exports.name, exports.body, exports.type)}
            >
              <Download />
            </Button>
          </Tip>
          <Tip label={copied ? "Copied" : `Copy${note}`} side="bottom">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={copied ? "Copied" : `Copy${note}`}
              onClick={copy}
            >
              {copied ? <Check /> : <Clipboard />}
            </Button>
          </Tip>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="border-b bg-destructive/10 px-4 py-2 text-xs text-destructive"
        >
          {error}
        </p>
      )}
      {(Object.keys(LABELS) as Format[]).map((f) => (
        <TabsContent key={f} value={f} className="flex min-h-0 flex-col">
          {/* JSON, MJML and Markdown edit in place; Apply parses them back into the email. */}
          <CodeEditor
            value={{ react, html: prettyHtml, text, json, mjml, markdown }[f]}
            dirty={draft !== null}
            language={LANGUAGES[f][0]}
            path={LANGUAGES[f][1]}
            label={`${LABELS[f]} source`}
            onChange={(v) => {
              setDraft(v)
              setError("")
            }}
            onSubmit={apply}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}
