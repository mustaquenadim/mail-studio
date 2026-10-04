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

type Tab = "linter" | "compat" | "spam" | "send"

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

type SendMode = "ethereal" | "smtp" | "resend"
const MODES: { id: SendMode; label: string; note: string }[] = [
  {
    id: "ethereal",
    label: "Test inbox",
    note: "Sends to a throwaway Ethereal inbox. Nothing is delivered; you get a link to view the message.",
  },
  { id: "smtp", label: "SMTP", note: "Sends through any SMTP server." },
  {
    id: "resend",
    label: "Resend",
    note: "Leave the key empty to use RESEND_API_KEY from .env.local.",
  },
]
const SMTP_PRESETS = [
  { label: "Gmail", host: "smtp.gmail.com", port: 465, secure: true },
  { label: "Outlook", host: "smtp.office365.com", port: 587, secure: false },
  { label: "QQ Mail", host: "smtp.qq.com", port: 465, secure: true },
  { label: "Aliyun", host: "smtpdm.aliyun.com", port: 465, secure: true },
  { label: "SendGrid", host: "smtp.sendgrid.net", port: 587, secure: false },
  { label: "Mailgun", host: "smtp.mailgun.org", port: 587, secure: false },
  {
    label: "Amazon SES",
    host: "email-smtp.us-east-1.amazonaws.com",
    port: 587,
    secure: false,
  },
]
const RECENT_KEY = "email-builder:recipients"
const readRecent = (): string[] => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}

// Credentials live in this component's state only; they're sent with the request and never saved.
function SendForm({
  html,
  text,
  defaultSubject,
}: {
  html: string
  text: string
  defaultSubject: string
}) {
  const [mode, setMode] = useState<SendMode>("ethereal")
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState(defaultSubject || "Test email")
  const [from, setFrom] = useState("")
  const [resendKey, setResendKey] = useState("")
  const [smtp, setSmtp] = useState({
    host: "",
    port: "587",
    secure: false,
    user: "",
    pass: "",
  })
  const [recent, setRecent] = useState<string[]>([])
  const [status, setStatus] = useState<{
    ok: boolean
    message: string
    url?: string
  } | null>(null)
  const [sending, setSending] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from browser storage
  useEffect(() => setRecent(readRecent()), [])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    const list = to
      .split(/[,;\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    setSending(true)
    setStatus(null)
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          to: list,
          subject,
          from,
          html,
          text,
          ...(mode === "resend" && { resendKey }),
          ...(mode === "smtp" && {
            smtp: { ...smtp, port: Number(smtp.port) },
          }),
        }),
      })
      const data = (await res.json()) as {
        error?: string
        previewUrl?: string
      }
      if (res.ok) {
        const next = [to.trim(), ...recent.filter((r) => r !== to.trim())]
        setRecent(next.slice(0, 8))
        try {
          localStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, 8)))
        } catch {}
      }
      setStatus(
        res.ok
          ? {
              ok: true,
              message: `Sent to ${list.join(", ")}.`,
              url: data.previewUrl,
            }
          : { ok: false, message: data.error ?? "Sending failed." }
      )
    } catch {
      setStatus({ ok: false, message: "Couldn't reach the server." })
    } finally {
      setSending(false)
    }
  }

  const field = (
    id: string,
    label: string,
    input: React.ReactNode,
    className = "min-w-40 flex-1"
  ) => (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {input}
    </div>
  )
  const setS = (p: Partial<typeof smtp>) => setSmtp((s) => ({ ...s, ...p }))

  return (
    <form onSubmit={send} className="flex flex-col gap-3 px-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="radiogroup"
          aria-label="Send with"
          className="flex items-center gap-0.5 rounded-lg border p-0.5"
        >
          {MODES.map((m) => (
            <Button
              key={m.id}
              type="button"
              size="sm"
              role="radio"
              aria-checked={mode === m.id}
              variant={mode === m.id ? "secondary" : "ghost"}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {MODES.find((m) => m.id === mode)?.note} Works in development only;
          credentials are sent with this request and never saved.
        </p>
      </div>

      {mode === "smtp" && (
        <div className="flex flex-wrap items-end gap-3">
          {field(
            "smtp-preset",
            "Preset",
            <select
              id="smtp-preset"
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
              value=""
              onChange={(e) => {
                const p = SMTP_PRESETS.find((x) => x.label === e.target.value)
                if (p)
                  setS({ host: p.host, port: String(p.port), secure: p.secure })
              }}
            >
              <option value="">Choose…</option>
              {SMTP_PRESETS.map((p) => (
                <option key={p.label}>{p.label}</option>
              ))}
            </select>,
            "w-32"
          )}
          {field(
            "smtp-host",
            "Host",
            <Input
              id="smtp-host"
              required
              value={smtp.host}
              onChange={(e) => setS({ host: e.target.value })}
            />
          )}
          {field(
            "smtp-port",
            "Port",
            <Input
              id="smtp-port"
              required
              inputMode="numeric"
              value={smtp.port}
              onChange={(e) =>
                setS({ port: e.target.value.replace(/\D/g, "") })
              }
            />,
            "w-20"
          )}
          <label className="flex h-8 items-center gap-2">
            <input
              type="checkbox"
              checked={smtp.secure}
              onChange={(e) => setS({ secure: e.target.checked })}
            />
            SSL/TLS
          </label>
          {field(
            "smtp-user",
            "User",
            <Input
              id="smtp-user"
              autoComplete="off"
              value={smtp.user}
              onChange={(e) => setS({ user: e.target.value })}
            />
          )}
          {field(
            "smtp-pass",
            "Password",
            <Input
              id="smtp-pass"
              type="password"
              autoComplete="off"
              value={smtp.pass}
              onChange={(e) => setS({ pass: e.target.value })}
            />
          )}
        </div>
      )}
      {mode === "resend" &&
        field(
          "resend-key",
          "Resend API key",
          <Input
            id="resend-key"
            type="password"
            autoComplete="off"
            placeholder="re_… (optional)"
            value={resendKey}
            onChange={(e) => setResendKey(e.target.value)}
          />,
          "max-w-sm"
        )}

      <div className="flex flex-wrap items-end gap-3">
        {field(
          "send-to",
          "To (comma-separated, up to 10)",
          <>
            <Input
              id="send-to"
              required
              list="send-recent"
              placeholder="you@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <datalist id="send-recent">
              {recent.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </>,
          "min-w-48 flex-1"
        )}
        {mode !== "ethereal" &&
          field(
            "send-from",
            "From",
            <Input
              id="send-from"
              placeholder={
                mode === "smtp" ? "Defaults to the SMTP user" : "Optional"
              }
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          )}
        {field(
          "send-subject",
          "Subject",
          <Input
            id="send-subject"
            required
            maxLength={200}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />,
          "min-w-48 flex-1"
        )}
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
        {status?.message}{" "}
        {status?.url && (
          <a
            href={status.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2"
          >
            View the message
            <ExternalLink className="size-3" />
          </a>
        )}
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
    { id: "send", label: "Send" },
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

          <TabsContent value="send">
            <SendForm
              html={html}
              text={text}
              defaultSubject={doc.settings.subject}
            />
          </TabsContent>
        </div>
      )}
    </Tabs>
  )
}
