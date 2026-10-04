// Run: pnpm dlx tsx lib/compat.check.ts
// Uses the live caniemail.com data when reachable, plus a fixed fixture that always runs.
import assert from "node:assert/strict"
import {
  compatibilityFindings,
  entryMatches,
  usedFeatures,
  type CaniData,
  type CaniEntry,
} from "./compat"
import { DEFAULT_SETTINGS, newBlock, toHtml } from "./email"

const html =
  "<html><head><style>@media (max-width:620px){.col{display:block!important}}</style></head>" +
  '<body><table role="presentation" width="600" style="max-width:600px;border-radius:6px"><tr><td>' +
  '<ul><li>a</li></ul><a style="display:inline-block">x</a></td></tr></table></body></html>'
const f = usedFeatures(html)
assert.ok(
  f.elements.has("table") && f.elements.has("ul") && f.attributes.has("role")
)
assert.ok(f.atRules.has("media") && f.mediaFeatures.has("max-width"))
assert.ok(
  !usedFeatures('<!--[if mso]><i hidden="">x</i><![endif]-->').attributes.has(
    "hidden"
  ),
  "Outlook-only conditional markup is ignored"
)
assert.ok(
  f.declarations.some((d) => d.prop === "border-radius" && d.value === "6px")
)

const entry = (category: string, title: string): CaniEntry => ({
  slug: title,
  title,
  category,
  url: "https://www.caniemail.com/x",
  stats: {},
  notes_by_num: null,
})
const yes = (c: string, t: string) => assert.ok(entryMatches(entry(c, t), f), t)
const no = (c: string, t: string) => assert.ok(!entryMatches(entry(c, t), f), t)
yes("html", "<table> element")
yes("html", "<ul>, <ol> and <dl>")
yes("html", "role attribute")
yes("html", "width attribute")
no("html", "<video> element")
no("html", "dir attribute")
yes("css", "@media")
yes("css", "@media (max-width)")
no("css", "@media (prefers-color-scheme)")
yes("css", "border-radius")
yes("css", "display:inline-block")
no("css", "display:flex")
no("css", "padding") // only exact property names match
no("css", "border-radius logical properties")
no("css", "calc() function")

// Classification: only entries unsupported ("n") in a checked client are reported, with notes.
const data: CaniData = {
  nicenames: {
    family: { outlook: "Outlook", gmail: "Gmail" },
    platform: { windows: "Windows", ios: "iOS" },
  },
  data: [
    {
      ...entry("css", "border-radius"),
      stats: {
        outlook: {
          windows: [{ "2016": "y" }, { "2019": "n #1" }],
          ios: [{ "1": "y" }],
        },
        gmail: { ios: [{ "1": "a #2" }] },
      },
      notes_by_num: { "1": "Use [VML](https://x) instead.", "2": "Partial." },
    },
    {
      ...entry("html", "<table> element"),
      stats: { gmail: { ios: [{ "1": "y" }] } },
    },
  ],
}
const found = compatibilityFindings(html, data)
assert.equal(found.length, 1)
assert.equal(
  found[0].message,
  "border-radius isn't supported in Outlook (Windows)."
)
assert.equal(found[0].detail, "Use VML instead.")

// Live data against a real email: expect the well-known Outlook gaps.
const live = await fetch("https://www.caniemail.com/api/data-ordered.json")
  .then((r) => r.json() as Promise<CaniData>)
  .catch(() => null)
if (live) {
  const email = toHtml({
    settings: DEFAULT_SETTINGS,
    blocks: [newBlock("button"), newBlock("columns")],
  })
  const messages = compatibilityFindings(email, live).map((x) => x.message)
  assert.ok(
    messages.some((m) => m.startsWith("border-radius") && m.includes("Outlook"))
  )
  console.log(`live caniemail: ${messages.length} findings`)
} else console.log("live caniemail data unreachable; fixture checks only")

console.log("compat checks passed")
