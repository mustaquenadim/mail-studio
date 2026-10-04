"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleX,
  ExternalLink,
  Info,
  Link2,
  Send,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tip } from "@/components/tip"
import { lint, spam, urlTargets, type Finding } from "@/lib/checks"
import { compatibilityFindings, type CaniData } from "@/lib/compat"
import { toReact, toText, type EmailDoc } from "@/lib/email"
import type { UrlResult } from "@/lib/url-check"

type Tab = "linter" | "compat" | "spam" | "resend"

const LEVEL = {
  error: { icon: CircleX, className: "text-destructive" },
  warning: {
    icon: TriangleAlert,
    className: "text-amber-600 dark:text-amber-400",
  },
  info: { icon: Info, className: "text-muted-foreground" },
}

const SPAM_API = "https://react.email/api/check-spam"
type SpamResult = {
  points: number
  isSpam: boolean
  checks: { name: string; description: string; points: number }[]
}

function Findings({
  findings,
  onSelect,
  empty = "No issues found.",
}: {
  findings: Finding[]
  onSelect: (id: string) => void
  empty?: string
}) {
  if (!findings.length)
    return (
      <p className="flex items-center gap-2 px-2 text-muted-foreground">
        <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
        {empty}
      </p>
    )
  return (
    <ul className="flex flex-col">
      {findings.map((f, i) => {
        const { icon: LevelIcon, className } = LEVEL[f.level]
        const content = (
          <>
            <LevelIcon className={cn("mt-0.5 size-4 shrink-0", className)} />
            <span className="sr-only">{f.level}: </span>
            <span className="min-w-0 break-words">
              {f.message}
              {f.detail && (
                <span className="block text-xs text-muted-foreground">
                  {f.detail}
                </span>
              )}
            </span>
          </>
        )
        return (
          <li key={i} className="flex items-start">
            {f.blockId ? (
              <button
                onClick={() => onSelect(f.blockId!)}
                className="flex min-w-0 flex-1 gap-2 rounded-md px-2 py-1.5 text-start hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                {content}
              </button>
            ) : (
              <div className="flex min-w-0 flex-1 gap-2 px-2 py-1.5">
                {content}
              </div>
            )}
            {f.href && (
              <a
                href={f.href}
                target="_blank"
                rel="noreferrer"
                className="me-1 mt-1 inline-flex shrink-0 items-center gap-1 rounded px-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Details
                <ExternalLink className="size-3" />
              </a>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// A row of actions/notes above a tab's results.
function Bar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pb-2 text-xs text-muted-foreground">
      {children}
    </div>
  )
}

function ResendForm({ html, text }: { html: string; text: string }) {
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("Test email")
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(
    null
  )
  const [sending, setSending] = useState(false)

  const send = async (e: FormEvent) => {
    e.preventDefault()
    setSending(true)
    setStatus(null)
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, html, text }),
      })
      const data = (await res.json()) as { id?: string; error?: string }
      setStatus(
        res.ok
          ? { ok: true, message: `Sent to ${to}.` }
          : { ok: false, message: data.error ?? "Sending failed." }
      )
    } catch {
      setStatus({ ok: false, message: "Couldn't reach the server." })
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-3 px-2 text-sm">
      <p className="text-xs text-muted-foreground">
        Sends a test through Resend using <code>RESEND_API_KEY</code> from{" "}
        <code>.env.local</code>. Works in development only.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="resend-to">To</Label>
          <Input
            id="resend-to"
            type="email"
            required
            placeholder="you@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="resend-subject">Subject</Label>
          <Input
            id="resend-subject"
            required
            maxLength={200}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={sending}>
          <Send />
          {sending ? "Sending…" : "Send test"}
        </Button>
      </div>
      <p
        role="status"
        className={cn(
          "text-xs",
          status?.ok
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-destructive"
        )}
      >
        {status?.message}
      </p>
    </form>
  )
}

const asList = (fs: Finding[]) =>
  fs.length
    ? fs.map((f) => `- ${f.level}: ${f.message}`).join("\n")
    : "- No issues"

// Results of a network check, tied to the HTML they were run against so stale ones are flagged.
type Run<T> = { html: string; value: T }

export function BottomPanel({
  doc,
  html,
  onSelect,
}: {
  doc: EmailDoc
  html: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("linter")
  const [copied, setCopied] = useState(false)

  const [caniemail, setCaniemail] = useState<CaniData | string | null>(null)
  const [urls, setUrls] = useState<Run<Finding[]> | null>(null)
  const [urlError, setUrlError] = useState("")
  const [checkingUrls, setCheckingUrls] = useState(false)
  const [spamRun, setSpamRun] = useState<Run<SpamResult> | null>(null)
  const [spamError, setSpamError] = useState("")
  const [checkingSpam, setCheckingSpam] = useState(false)

  // caniemail.com data (via our cached proxy), loaded the first time the panel opens.
  useEffect(() => {
    if (!open || caniemail) return
    fetch("/api/caniemail")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: CaniData) => setCaniemail(d))
      .catch(() => setCaniemail("Couldn't load caniemail.com data."))
  }, [open, caniemail])

  const text = useMemo(() => toText(doc), [doc])
  const results = useMemo(
    () => ({
      linter: lint(doc, html),
      compat:
        typeof caniemail === "object" && caniemail
          ? compatibilityFindings(html, caniemail)
          : [],
      spam: spam(doc, text),
    }),
    [doc, html, text, caniemail]
  )
  const linter = [...results.linter, ...(urls?.value ?? [])]

  const checkUrls = async () => {
    const targets = urlTargets(doc)
    const unique = [
      ...new Map(targets.map((t) => [`${t.kind} ${t.url}`, t])).values(),
    ].map(({ url, kind }) => ({ url, kind }))
    setCheckingUrls(true)
    setUrlError("")
    try {
      const res = await fetch("/api/check-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets: unique }),
      })
      const data = (await res.json()) as {
        results?: UrlResult[]
        error?: string
      }
      if (!res.ok || !data.results)
        throw new Error(data.error ?? "Checking failed.")
      const byKey = new Map(data.results.map((r) => [`${r.kind} ${r.url}`, r]))
      const findings = targets.flatMap((t): Finding[] => {
        const r = byKey.get(`${t.kind} ${t.url}`)
        if (!r || r.status === "ok") return []
        return [
          {
            level: r.status,
            message: `${t.kind === "image" ? "Image" : "Link"} ${t.url} ${r.message}`,
            blockId: t.blockId,
          },
        ]
      })
      setUrls({ html, value: findings })
    } catch (e) {
      setUrlError(e instanceof Error ? e.message : "Checking failed.")
    } finally {
      setCheckingUrls(false)
    }
  }

  const checkSpam = async () => {
    setCheckingSpam(true)
    setSpamError("")
    try {
      const res = await fetch(SPAM_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, plainText: text }),
      })
      const data = (await res.json()) as SpamResult & { error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? "Check failed.")
      setSpamRun({ html, value: data })
    } catch (e) {
      setSpamError(
        e instanceof Error ? e.message : "Couldn't reach react.email."
      )
    } finally {
      setCheckingSpam(false)
    }
  }

  const copyForAi = () => {
    const spamLines = spamRun
      ? [
          `- SpamAssassin: ${spamRun.value.points} points (${spamRun.value.isSpam ? "spam" : "not spam"}; 5+ is spam)`,
          ...spamRun.value.checks.map(
            (c) =>
              `- ${c.points > 0 ? "+" : ""}${c.points} ${c.name}: ${c.description}`
          ),
        ].join("\n")
      : null
    const prompt = [
      "I'm building an HTML email. Below are automated check results and the email's React source (React Email components).",
      "Suggest concrete fixes for the issues.",
      "",
      "## Linter",
      asList(linter),
      "",
      "## Email client compatibility (caniemail.com; Gmail, Apple Mail, Outlook, Yahoo)",
      typeof caniemail === "object" && caniemail
        ? asList(results.compat)
        : "- Not checked",
      "",
      "## Spam",
      ...(spamLines ? [spamLines] : []),
      asList(results.spam),
      "",
      "## Source (React Email; renders the exact email HTML)",
      "```tsx",
      toReact(doc).trimEnd(),
      "```",
      "",
    ].join("\n")
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  // Count only what needs attention, like a problems panel.
  const count = (fs: Finding[]) => fs.filter((f) => f.level !== "info").length
  const tabs: { id: Tab; label: string; n?: number; errors?: boolean }[] = [
    {
      id: "linter",
      label: "Linter",
      n: count(linter),
      errors: linter.some((f) => f.level === "error"),
    },
    { id: "compat", label: "Compatibility", n: count(results.compat) },
    {
      id: "spam",
      label: "Spam",
      n: count(results.spam) + (spamRun?.value.isSpam ? 1 : 0),
      errors: !!spamRun?.value.isSpam,
    },
    { id: "resend", label: "Resend" },
  ]
  const stale = (run: Run<unknown> | null) =>
    run &&
    run.html !== html && (
      <span className="text-amber-600 dark:text-amber-400">
        The email changed since this check.
      </span>
    )

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        setTab(v as Tab)
        setOpen(true)
      }}
      className="shrink-0 gap-0 border-t bg-background"
    >
      <div className="flex items-center justify-between gap-2 px-2">
        <TabsList variant="line" className="h-10">
          {tabs.map(({ id, label, n, errors }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="px-3"
              // Clicking the current tab while collapsed should still open the panel.
              onClick={() => setOpen(true)}
            >
              {label}
              {!!n && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    errors
                      ? "bg-destructive/15 text-destructive"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {n}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="flex items-center gap-1">
          <Tip
            label="Copy the check results and React source as a prompt"
            side="top"
          >
            <Button size="sm" variant="ghost" onClick={copyForAi}>
              {copied ? "Copied" : "Copy for AI"}
            </Button>
          </Tip>
          <Popover>
            <Tip label="About these checks" side="top">
              <PopoverTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="About these checks"
                  />
                }
              >
                <Info />
              </PopoverTrigger>
            </Tip>
            <PopoverContent side="top" align="end" className="w-80 text-xs">
              <p>
                <strong>Linter</strong> checks links, alt text, color contrast,
                empty blocks and Gmail&apos;s 102KB clipping limit as you edit.{" "}
                <em>Check links &amp; images</em> loads every URL from your
                machine to confirm it works (development only).
              </p>
              <p>
                <strong>Compatibility</strong> lists features this email uses
                that Gmail, Apple Mail, Outlook or Yahoo don&apos;t support,
                using live data from{" "}
                <a
                  href="https://www.caniemail.com"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  caniemail.com
                </a>
                .
              </p>
              <p>
                <strong>Spam</strong> runs quick checks as you edit.{" "}
                <em>Check with SpamAssassin</em> sends the email to
                react.email&apos;s SpamAssassin service (run by Resend) for a
                real score.
              </p>
              <p>
                Approach and rules adapted from React Email&apos;s preview tools
                (MIT License).
              </p>
            </PopoverContent>
          </Popover>
          <Tip label={open ? "Collapse panel" : "Expand panel"} side="top">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={open ? "Collapse panel" : "Expand panel"}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <ChevronDown /> : <ChevronUp />}
            </Button>
          </Tip>
        </div>
      </div>
      {open && (
        <div className="h-64 overflow-y-auto border-t py-3 text-sm">
          <TabsContent value="linter">
            <Bar>
              <Button
                size="sm"
                variant="outline"
                disabled={checkingUrls}
                onClick={checkUrls}
              >
                <Link2 />
                {checkingUrls ? "Checking…" : "Check links & images"}
              </Button>
              {urls && !urlError && (
                <span>
                  {urls.value.length
                    ? `${urls.value.length} link or image issues found.`
                    : "All links and images loaded."}
                </span>
              )}
              {stale(urls)}
              {urlError && (
                <span role="alert" className="text-destructive">
                  {urlError}
                </span>
              )}
            </Bar>
            <Findings findings={linter} onSelect={onSelect} />
          </TabsContent>

          <TabsContent value="compat">
            {caniemail === null ? (
              <Bar>Loading caniemail.com data…</Bar>
            ) : typeof caniemail === "string" ? (
              <Bar>
                <span role="alert" className="text-destructive">
                  {caniemail}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCaniemail(null)}
                >
                  Retry
                </Button>
              </Bar>
            ) : (
              <>
                <Bar>
                  Features this email uses that Gmail, Apple Mail, Outlook or
                  Yahoo don&apos;t support (latest versions).
                </Bar>
                <Findings
                  findings={results.compat}
                  onSelect={onSelect}
                  empty="Everything this email uses is supported."
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="spam">
            <Bar>
              <Button
                size="sm"
                variant="outline"
                disabled={checkingSpam}
                onClick={checkSpam}
              >
                <ShieldCheck />
                {checkingSpam ? "Checking…" : "Check with SpamAssassin"}
              </Button>
              <span>Sends this email to react.email (run by Resend).</span>
              {stale(spamRun)}
              {spamError && (
                <span role="alert" className="text-destructive">
                  {spamError}
                </span>
              )}
            </Bar>
            {spamRun && (
              <div className="mb-3 px-2">
                <p className="font-medium">
                  Score {(10 - spamRun.value.points).toFixed(1)} / 10
                  <span
                    className={cn(
                      "ms-2 text-xs font-normal",
                      spamRun.value.isSpam
                        ? "text-destructive"
                        : "text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {spamRun.value.isSpam
                      ? "Likely marked as spam (5+ points)"
                      : "Not marked as spam"}
                  </span>
                </p>
                <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                  {spamRun.value.checks.map((c) => (
                    <li key={c.name} className="flex gap-2">
                      <span className="w-10 shrink-0 text-end tabular-nums">
                        {c.points > 0 ? "+" : ""}
                        {c.points}
                      </span>
                      <span>
                        <code>{c.name}</code>{" "}
                        <span className="text-muted-foreground">
                          {c.description}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
              Quick checks
            </p>
            <Findings findings={results.spam} onSelect={onSelect} />
          </TabsContent>

          <TabsContent value="resend">
            <ResendForm html={html} text={text} />
          </TabsContent>
        </div>
      )}
    </Tabs>
  )
}
