// Run: pnpm dlx tsx lib/email.check.tsx
import assert from "node:assert/strict"
import * as React from "react"
import ts from "typescript"
import * as ReactEmail from "react-email"
import {
  DEFAULT_SETTINGS,
  DEFAULTS,
  findBlock,
  formatHtml,
  insertBlock,
  isContainer,
  moveBlock,
  newBlock,
  nudgeBlock,
  parseDoc,
  removeBlock,
  toEditableHtml,
  toHtml,
  toReact,
  toText,
  type Block,
  type BlockType,
  type EmailDoc,
} from "./email"

// Rendering: escaping, unsafe URLs, Outlook-safe attributes.
const doc: EmailDoc = {
  settings: DEFAULT_SETTINGS,
  blocks: [
    { ...newBlock("text"), body: "<script>alert(1)</script>" } as Block,
    { ...newBlock("button"), href: "javascript:alert(1)" } as Block,
    newBlock("spacer"),
  ],
}
const html = toHtml(doc)
assert.ok(html.startsWith("<!DOCTYPE html"))
assert.ok(html.includes("&lt;script&gt;"), "user text is escaped")
assert.ok(!html.includes("<script>"))
assert.ok(!html.includes("javascript:"), "unsafe hrefs are dropped")
assert.ok(
  html.includes("<!--[if mso]>") && html.includes("mso-padding-alt"),
  "React Email's Button adds the Outlook padding fix"
)

// Preview text: hidden preheader when set, nothing when empty.
const withPreview = toHtml({
  settings: { ...DEFAULT_SETTINGS, preview: "Big news inside" },
  blocks: [],
})
assert.ok(/<div[^>]*display:none[^>]*>Big news inside/.test(withPreview))
assert.ok(!html.includes("display:none"), "no preheader when preview is empty")

// Every block type renders.
const all = (Object.keys(DEFAULTS) as BlockType[])
  .filter((t) => t !== "column")
  .map((t) => newBlock(t))
assert.doesNotThrow(() => toHtml({ settings: DEFAULT_SETTINGS, blocks: all }))
assert.equal(
  newBlock("columns", 3).type === "columns" &&
    (newBlock("columns", 3) as { children: Block[] }).children.length,
  3
)

// Tree edits respect nesting rules.
const cols = newBlock("columns")
const col = isContainer(cols) ? cols.children[0] : assert.fail()
const text = newBlock("text")
const section = newBlock("section")
let tree: Block[] = [cols, text, section]

tree = moveBlock(tree, text.id, col.id, "inside")
assert.equal(
  findBlock(tree, col.id) &&
    isContainer(findBlock(tree, col.id)!) &&
    (findBlock(tree, col.id) as { children: Block[] }).children[0].id,
  text.id,
  "text moves into a column"
)
assert.equal(tree.length, 2)

assert.equal(
  moveBlock(tree, section.id, col.id, "inside"),
  tree,
  "no section inside a column"
)
assert.equal(
  moveBlock(tree, section.id, text.id, "before"),
  tree,
  "no section next to a block in a column"
)
assert.equal(
  insertBlock(tree, newBlock("column"), null, "inside"),
  tree,
  "no column at the root"
)
assert.equal(
  moveBlock(tree, cols.id, col.id, "inside"),
  tree,
  "can't move a block into itself"
)

tree = moveBlock(tree, cols.id, section.id, "inside")
assert.equal(tree.length, 1, "columns move into a section")
assert.equal(
  nudgeBlock(tree, section.id, -1),
  tree,
  "nudge past the edge is a no-op"
)
tree = removeBlock(tree, text.id)
assert.equal(findBlock(tree, text.id), undefined)

// Parsing: round-trip, legacy docs, and rejections.
const nested: EmailDoc = { settings: DEFAULT_SETTINGS, blocks: tree }
assert.equal(parseDoc(JSON.stringify(nested))?.blocks[0].type, "section")
const legacy = {
  settings: DEFAULT_SETTINGS,
  blocks: [
    {
      id: "x",
      type: "heading",
      text: "Hi",
      size: 28,
      color: "#111111",
      align: "left",
    },
  ],
}
assert.equal(
  parseDoc(JSON.stringify(legacy))?.blocks[0].type,
  "heading",
  "old drafts still load"
)
const noPreview = { bg: "#ffffff", contentBg: "#ffffff", width: 600 }
assert.equal(
  parseDoc(JSON.stringify({ settings: noPreview, blocks: [] }))?.settings
    .preview,
  "",
  "drafts saved before preview text existed still load"
)
assert.equal(parseDoc("not json"), null)
assert.equal(parseDoc("null"), null)
assert.equal(
  parseDoc(JSON.stringify({ ...doc, blocks: [{ type: "video" }] })),
  null
)
assert.equal(
  parseDoc(
    JSON.stringify({ ...doc, blocks: [{ type: "spacer", height: "big" }] })
  ),
  null
)
assert.equal(
  parseDoc(
    JSON.stringify({ ...doc, blocks: [{ type: "column", children: [] }] })
  ),
  null,
  "column at root rejected"
)
assert.equal(
  parseDoc(
    JSON.stringify({
      ...doc,
      blocks: [{ type: "columns", gap: 0, children: [] }],
    })
  ),
  null,
  "empty columns rejected"
)
assert.equal(
  parseDoc(
    JSON.stringify({ ...doc, settings: { ...DEFAULT_SETTINGS, bg: "red;x:y" } })
  ),
  null
)

// Formatting: indents nested tags, keeps text intact, and loses nothing but whitespace.
assert.equal(
  formatHtml('<div><p>a<br/>b</p><img src="x"/></div>'),
  '<div>\n  <p>a<br/>b</p>\n  <img src="x"/>\n</div>'
)
const fullHtml = toHtml({ settings: DEFAULT_SETTINGS, blocks: all })
assert.equal(formatHtml(fullHtml).replace(/\n */g, ""), fullHtml)
assert.ok(
  formatHtml(fullHtml).trimEnd().endsWith("\n</html>"),
  "depth returns to 0"
)

// React source: compile it with TypeScript, render it, and get the exact same HTML.
const richDoc: EmailDoc = {
  settings: DEFAULT_SETTINGS,
  blocks: [
    ...all,
    {
      ...newBlock("code"),
      body: 'if (a < b) { return "x" }\n  indented & {braces}',
    } as Block,
    { ...newBlock("text"), body: '  quote " and \\ backslash ' } as Block,
    {
      ...newBlock("text"),
      body: 'Hello <b>bold</b> and <i>it</i> <a href="https://x.test">link</a>\nnext <u>line</u>',
    } as Block,
    {
      ...newBlock("bulletList"),
      items: "<b>one</b> item\ntwo &amp; <s>three</s>",
    } as Block,
  ],
}
richDoc.settings = { ...DEFAULT_SETTINGS, preview: "Preview & more" }
const source = toReact(richDoc)
assert.ok(
  source.startsWith("import { Body, Button, "),
  "imports React Email components"
)
const js = ts.transpileModule(source, {
  compilerOptions: {
    jsx: ts.JsxEmit.React,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText
const mod: { default?: () => React.ReactNode } = {}
const requireShim = (m: string) => {
  if (m !== "react-email") throw new Error(`unexpected import ${m}`)
  return ReactEmail
}
new Function("React", "exports", "require", js)(React, mod, requireShim)
const exported = toHtml(richDoc)
// And React Email's own render() of the generated component matches what we export,
// apart from the comment markers React's streaming renderer leaves (<!--$-->, <!--html-->, ...).
const streamMarkers = /<!--(\$|\/\$|html|head|body)-->/g
assert.equal(
  (await ReactEmail.render(React.createElement(mod.default!))).replace(
    streamMarkers,
    ""
  ),
  exported,
  "render() from react-email produces the exported HTML"
)

// Plain text.
const plain = toText({
  settings: DEFAULT_SETTINGS,
  blocks: [
    { ...newBlock("title"), text: "Hello" } as Block,
    { ...newBlock("bulletList"), items: "a\n\nb" } as Block,
    { ...newBlock("button"), text: "Go", href: "https://x.test" } as Block,
    { ...newBlock("button"), text: "Bad", href: "javascript:x" } as Block,
  ],
})
assert.equal(plain, "Hello\n\n- a\n- b\n\nGo: https://x.test\n\nBad\n")

// Editable preview markup: has edit attributes; exported HTML and React never do.
const editable = toEditableHtml(richDoc)
// HTML attribute names are case-insensitive; React writes "contentEditable".
assert.ok(
  editable.includes("data-block=") &&
    /contenteditable="plaintext-only"/i.test(editable)
)
for (const out of [toHtml(richDoc), toReact(richDoc)])
  assert.ok(
    !/data-block|data-field|contenteditable/i.test(out),
    "edit attributes never leak into exports"
  )

console.log("email checks passed")
