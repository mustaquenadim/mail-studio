// Run: pnpm dlx tsx lib/rich.check.tsx
import assert from "node:assert/strict"
import { renderToStaticMarkup } from "react-dom/server"
import { links, parseInline, plainText, renderInline } from "./rich"
import { safeUrl } from "./email"

const html = (s: string) =>
  renderToStaticMarkup(<>{renderInline(s, safeUrl)}</>)

// Allowed tags render; aliases normalize; nesting works.
assert.equal(
  html("a <b>bold <i>both</i></b> <strong>s</strong> <em>e</em>"),
  "a <b>bold <i>both</i></b> <b>s</b> <i>e</i>"
)
assert.equal(html("x\ny"), "x<br/>y")

// Anything else stays literal, escaped text. Plain text with "<" or "&" survives.
assert.equal(
  html('<script>alert(1)</script><img src=x onerror="y">'),
  "&lt;script&gt;alert(1)&lt;/script&gt;&lt;img src=x onerror=&quot;y&quot;&gt;"
)
assert.equal(html("a < b & c"), "a &lt; b &amp; c")
assert.equal(html("&lt;b&gt;"), "&lt;b&gt;", "escaped tags stay text")

// Links: safe ones render, unsafe ones drop the <a> but keep the text.
assert.equal(
  html('<a href="https://x.test/?a=1&amp;b=2">go</a>'),
  '<a href="https://x.test/?a=1&amp;b=2">go</a>'
)
assert.equal(html('<a href="javascript:alert(1)">bad</a>'), "bad")
assert.deepEqual(
  links('<a href="https://a.test">a</a> <b><a href="x">b</a></b>'),
  ["https://a.test", "x"]
)

// Unbalanced markup doesn't throw or leak.
assert.equal(html("<b>open"), "<b>open</b>")
assert.equal(html("close</b> me"), "close me")
assert.ok(parseInline("").length === 0)

// Plain text strips formatting and spells out links.
assert.equal(
  plainText(
    'Hi <b>there</b>, see <a href="https://x.test">docs</a> &amp; more'
  ),
  "Hi there, see docs (https://x.test) & more"
)

console.log("rich checks passed")
