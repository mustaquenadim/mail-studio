// Run: pnpm dlx tsx lib/checks.check.ts
import assert from "node:assert/strict"
import { contrast, lint, spam } from "./checks"
import {
  DEFAULT_SETTINGS,
  newBlock,
  toHtml,
  toText,
  type Block,
  type EmailDoc,
} from "./email"

const doc = (blocks: Block[], width = 600): EmailDoc => ({
  settings: { ...DEFAULT_SETTINGS, width },
  blocks,
})
const messages = (fs: { message: string }[]) =>
  fs.map((f) => f.message).join("\n")

assert.equal(Math.round(contrast("#000000", "#ffffff")), 21)
assert.equal(contrast("#777777", "#777777"), 1)

// Linter
const badButton = {
  ...newBlock("button"),
  href: "javascript:x",
  color: "#ffffff",
  bg: "#eeeeee",
} as Block
const linkedImage = {
  ...newBlock("image"),
  alt: "",
  href: "https://x.test",
} as Block
const d1 = doc([badButton, linkedImage], 800)
const l1 = lint(d1, toHtml(d1))
assert.ok(
  l1.some(
    (f) =>
      f.level === "error" &&
      f.blockId === badButton.id &&
      /link/.test(f.message)
  )
)
assert.ok(
  l1.some((f) => f.blockId === badButton.id && /contrast/.test(f.message))
)
assert.ok(
  l1.some(
    (f) =>
      f.level === "error" &&
      f.blockId === linkedImage.id &&
      /alt/.test(f.message)
  )
)
assert.ok(/800px/.test(messages(l1)))

// Text inside a dark section is judged against the section's background.
const section = {
  ...newBlock("section"),
  bg: "#000000",
  children: [{ ...newBlock("text"), color: "#111111" }],
} as Block
assert.ok(/Text contrast/.test(messages(lint(doc([section]), ""))))
const clean = doc([newBlock("title"), newBlock("text")])
assert.deepEqual(lint(clean, toHtml(clean)), [])
assert.ok(/clips/.test(messages(lint(clean, "x".repeat(110 * 1024)))))

// Spam heuristics
const spammy = doc([
  {
    ...newBlock("text"),
    body: "ACT NOW!!! FREE MONEY FOR EVERY WINNER TODAY ONLY CLICK HERE NOW",
  } as Block,
])
const s1 = messages(spam(spammy, toText(spammy)))
assert.ok(
  /spam phrases/.test(s1) &&
    /ALL CAPS/.test(s1) &&
    /exclamation/.test(s1) &&
    /unsubscribe/.test(s1)
)
const polite = doc([
  {
    ...newBlock("text"),
    body: "Thanks for reading. Unsubscribe any time.",
  } as Block,
])
assert.deepEqual(spam(polite, toText(polite)), [])

console.log("checks passed")
