"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Check, Clipboard, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tip } from "@/components/tip"
import { formatHtml, toReact, toText, type EmailDoc } from "@/lib/email"

type Format = "react" | "html" | "text" | "json"

// strings | tags | attribute names | keywords | punctuation
const TOKEN =
  /("(?:[^"\\]|\\.)*")|(<\/?[\w.$-]+|\/?>)|([\w$-]+)(?==)|\b(import|export|default|function|return|const|from)\b|([{}()])/g
const TOKEN_CLASS = [
  "text-emerald-700 dark:text-emerald-300",
  "text-sky-700 dark:text-sky-300",
  "text-violet-700 dark:text-violet-300",
  "text-pink-700 dark:text-pink-400",
  "text-muted-foreground",
]

function highlight(line: string) {
  const out: ReactNode[] = []
  let last = 0
  for (const m of line.matchAll(TOKEN)) {
    if (m.index > last) out.push(line.slice(last, m.index))
    const group = m.slice(1).findIndex((g) => g !== undefined)
    out.push(
      <span key={m.index} className={TOKEN_CLASS[group]}>
        {m[0]}
      </span>
    )
    last = m.index + m[0].length
  }
  out.push(line.slice(last))
  return out
}

function Code({ text, plain }: { text: string; plain?: boolean }) {
  const lines = text.replace(/\n$/, "").split("\n")
  return (
    <pre className="min-h-0 flex-1 overflow-auto py-3 font-mono text-xs leading-relaxed">
      {lines.map((line, i) => (
        <div key={i} className="flex">
          <span
            aria-hidden
            className="sticky left-0 w-12 shrink-0 bg-background pe-4 text-end text-muted-foreground/60 select-none"
          >
            {i + 1}
          </span>
          <span className="pe-4 whitespace-pre">
            {plain ? line : highlight(line)}
          </span>
        </div>
      ))}
    </pre>
  )
}

function save(name: string, text: string, type: string) {
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href))
}

export function CodeView({ doc, html }: { doc: EmailDoc; html: string }) {
  const [format, setFormat] = useState<Format>("react")
  const [copied, setCopied] = useState(false)
  const react = useMemo(() => toReact(doc), [doc])
  const text = useMemo(() => toText(doc), [doc])
  const prettyHtml = useMemo(() => formatHtml(html), [html])
  // Same format as Export JSON, so it can be imported back.
  const json = useMemo(() => JSON.stringify(doc, null, 2) + "\n", [doc])

  // What each tab exports. HTML exports the exact markup, not the indented view.
  const exports = {
    react: { name: "Email.tsx", body: react, type: "text/plain" },
    html: { name: "email.html", body: html, type: "text/html" },
    text: { name: "email.txt", body: text, type: "text/plain" },
    json: { name: "email.json", body: json, type: "application/json" },
  }[format]
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
      onValueChange={(v) => setFormat(v as Format)}
      className="m-4 min-h-0 flex-1 gap-0 overflow-hidden rounded-lg border bg-background"
    >
      <div className="flex items-center justify-between border-b bg-muted/40 pe-2">
        <TabsList variant="line" className="h-10 px-2">
          <TabsTrigger value="react" className="px-3">
            React
          </TabsTrigger>
          <TabsTrigger value="html" className="px-3">
            HTML
          </TabsTrigger>
          <TabsTrigger value="text" className="px-3">
            Plain Text
          </TabsTrigger>
          <TabsTrigger value="json" className="px-3">
            JSON
          </TabsTrigger>
        </TabsList>
        <div className="flex gap-1">
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
      <TabsContent value="react" className="flex min-h-0 flex-col">
        <Code text={react} />
      </TabsContent>
      <TabsContent value="html" className="flex min-h-0 flex-col">
        <Code text={prettyHtml} />
      </TabsContent>
      <TabsContent value="text" className="flex min-h-0 flex-col">
        <Code text={text} plain />
      </TabsContent>
      <TabsContent value="json" className="flex min-h-0 flex-col">
        <Code text={json} />
      </TabsContent>
    </Tabs>
  )
}
