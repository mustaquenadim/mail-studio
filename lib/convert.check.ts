// Run: pnpm dlx tsx lib/convert.check.ts
// (fromMjml/fromHtml need a browser DOMParser; they're covered by the MJML round trip in the app.)
import assert from "node:assert/strict"
import {
  DEFAULT_SETTINGS,
  convertBlock,
  duplicateBlock,
  findBlock,
  insertBlock,
  isLocked,
  moveBlock,
  newBlock,
  nudgeBlock,
  parseDoc,
  pathTo,
  removeBlock,
  setLocked,
  toHtml,
  updateBlock,
  type Block,
  type EmailDoc,
} from "./email"
import { toMarkdown, fromMarkdown, toMjml } from "./convert"
import { lint } from "./checks"
import { COLLECTIONS } from "./collections"
import {
  LAYOUTS,
  TEMPLATES,
  applyLayout,
  detachLayout,
  slotOf,
} from "./templates"

const types = (d: EmailDoc) => d.blocks.map((b) => b.type)

// Markdown round trip keeps block types, text and formatting.
const md: EmailDoc = {
  settings: { ...DEFAULT_SETTINGS, subject: "Hi", preview: "Pre" },
  blocks: [
    { ...newBlock("title"), text: "Big <b>news</b>" } as Block,
    {
      ...newBlock("text"),
      body: 'Read <a href="https://x.test">this</a> &amp; *that*\nsecond line',
    } as Block,
    { ...newBlock("bulletList"), items: "one\n<i>two</i>" } as Block,
    { ...newBlock("numberedList"), items: "a\nb" } as Block,
    { ...newBlock("quote"), body: "wise" } as Block,
    { ...newBlock("code"), body: "x < 1 && *y*" } as Block,
    { ...newBlock("button"), text: "Go", href: "https://go.test" } as Block,
    { ...newBlock("image"), src: "https://i.test/a.png", alt: "A" } as Block,
    newBlock("divider"),
    { ...newBlock("table"), rows: "h1 | h2\nc1 | c2" } as Block,
  ],
}
const back = fromMarkdown(toMarkdown(md))
assert.ok(back, "markdown parses back")
assert.deepEqual(types(back), types(md))
assert.equal(back.settings.subject, "Hi")
assert.equal(back.settings.preview, "Pre")
const field = (d: EmailDoc, i: number, k: string) =>
  (d.blocks[i] as unknown as Record<string, unknown>)[k]
for (const [i, k] of [
  [0, "text"],
  [1, "body"],
  [2, "items"],
  [3, "items"],
  [4, "body"],
  [5, "body"],
  [6, "text"],
  [6, "href"],
  [7, "src"],
  [7, "alt"],
  [9, "rows"],
] as const)
  assert.equal(
    field(back, i, k),
    field(md, i, k),
    `markdown keeps ${k} of block ${i}`
  )
assert.equal(
  fromMarkdown("[x](javascript:void)")?.blocks[0] &&
    field(fromMarkdown("[x](javascript:void)")!, 0, "body"),
  "x",
  "unsafe markdown links are dropped"
)

// MJML: every block type produces balanced markup inside mj-body.
const every = TEMPLATES.flatMap((t) => t.build().blocks)
const mjml = toMjml({ settings: DEFAULT_SETTINGS, blocks: every })
assert.ok(mjml.startsWith("<mjml") && mjml.includes("<mj-body"))
// The head has a self-closing <mj-section> default, so count in the body.
const body = mjml.slice(mjml.indexOf("<mj-body"))
for (const t of ["mj-section", "mj-column", "mj-text", "mj-hero"])
  assert.equal(
    body.split(`<${t}`).length,
    body.split(`</${t}>`).length,
    `${t} is balanced`
  )
assert.ok(!mjml.includes("javascript:"))

// Locking: every edit refuses a locked block or anything inside it; setLocked still works.
const inner = newBlock("text")
const sec = { ...newBlock("section"), locked: true, children: [inner] } as Block
const free = newBlock("text")
const tree: Block[] = [sec, free]
assert.ok(isLocked(tree, inner.id))
assert.equal(updateBlock(tree, inner.id, { body: "x" }), tree)
assert.equal(removeBlock(tree, sec.id), tree)
assert.equal(nudgeBlock(tree, sec.id, 1), tree)
assert.equal(moveBlock(tree, inner.id, free.id, "after"), tree)
assert.equal(moveBlock(tree, free.id, sec.id, "inside"), tree)
assert.equal(insertBlock(tree, newBlock("text"), inner.id, "after"), tree)
assert.equal(convertBlock(tree, inner.id, "title"), tree)
assert.notEqual(insertBlock(tree, newBlock("text"), sec.id, "after"), tree)
const unlocked = setLocked(tree, sec.id, false)
assert.ok(!isLocked(unlocked, inner.id))
assert.notEqual(updateBlock(unlocked, inner.id, { body: "x" }), unlocked)
assert.deepEqual(
  pathTo(tree, inner.id).map((b) => b.id),
  [sec.id, inner.id]
)

// Duplicate: fresh ids all the way down, lock dropped, placed right after.
const [dup, copyId] = duplicateBlock(unlocked, sec.id)
const copy = findBlock(dup, copyId)!
assert.equal(dup[1].id, copyId)
assert.notEqual(copyId, sec.id)
assert.notEqual((copy as { children: Block[] }).children[0].id, inner.id)
assert.equal(
  duplicateBlock(tree, inner.id)[0],
  tree,
  "no duplicating inside a locked block"
)

// Turn into keeps the text.
const turned = convertBlock([free], free.id, "heading")
assert.equal(turned[0].type, "heading")
assert.equal(
  (turned[0] as { text: string }).text,
  (free as { body: string }).body
)

// Templates and layouts are valid docs that survive save/load and render.
const collected = COLLECTIONS.flatMap((c) => c.templates)
assert.equal(collected.length, 40, "5 collections × 8 emails")
assert.equal(new Set(collected.map((t) => t.id)).size, 40, "unique ids")
for (const t of [...TEMPLATES, ...collected]) {
  const d = t.build()
  assert.ok(parseDoc(JSON.stringify(d)), `template ${t.id} is valid`)
  assert.doesNotThrow(() => toHtml(d))
  assert.ok(
    lint(d, toHtml(d)).every((f) => f.level !== "error"),
    `template ${t.id} has no lint errors: ${JSON.stringify(lint(d, toHtml(d)).filter((f) => f.level === "error"))}`
  )
}
const content: EmailDoc = {
  settings: DEFAULT_SETTINGS,
  blocks: [newBlock("text"), newBlock("section")],
}
for (const l of LAYOUTS) {
  const d = applyLayout(content, l.id)
  assert.ok(parseDoc(JSON.stringify(d)), `layout ${l.id} is valid`)
  assert.equal(d.settings.layout, l.id)
  assert.equal(
    slotOf(d.blocks) &&
      (slotOf(d.blocks) as { children: Block[] }).children.length,
    1,
    "sections are lifted out of the slot"
  )
}
const switched = applyLayout(applyLayout(content, "sunrise"), "luxe")
assert.equal(
  (slotOf(switched.blocks) as { children: Block[] }).children[0].id,
  content.blocks[0].id,
  "switching keeps slot content"
)
const detached = detachLayout(switched)
assert.ok(!JSON.stringify(detached).includes('"locked"'))
assert.equal(detached.settings.layout, "")

console.log("convert checks passed")
