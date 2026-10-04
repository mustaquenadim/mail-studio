// Run: pnpm dlx tsx lib/url-check.check.ts
import assert from "node:assert/strict"
import { checkUrl, isPrivateAddress } from "./url-check"

for (const ip of [
  "127.0.0.1",
  "10.1.2.3",
  "192.168.1.1",
  "172.20.0.1",
  "169.254.169.254",
  "100.64.0.1",
  "0.0.0.0",
  "::1",
  "fd00::1",
  "fe80::1",
  "::ffff:127.0.0.1",
])
  assert.ok(isPrivateAddress(ip), ip)
for (const ip of ["8.8.8.8", "172.32.0.1", "93.184.215.14", "2606:4700::1111"])
  assert.ok(!isPrivateAddress(ip), ip)

// Private targets are refused before any request is made.
assert.equal((await checkUrl("http://127.0.0.1:3000/", "link")).status, "error")
assert.match(
  (await checkUrl("http://localhost/", "link")).message ?? "",
  /private or local/
)
assert.equal((await checkUrl("not a url", "link")).status, "error")
assert.equal((await checkUrl("ftp://example.com/x", "link")).status, "error")

// Live: a page that exists, one that doesn't, and a non-image used as an image.
const ok = await checkUrl("https://example.com/", "link")
if (ok.message === "couldn't be reached.")
  console.log("offline; skipped live checks")
else {
  assert.equal(ok.status, "ok", JSON.stringify(ok))
  assert.equal(
    (await checkUrl("https://example.com/", "image")).status,
    "warning"
  )
  const missing = await checkUrl("https://httpbin.org/status/404", "link")
  assert.ok(missing.status === "error", JSON.stringify(missing))
  const redirect = await checkUrl(
    "https://httpbin.org/redirect-to?url=https://example.com",
    "link"
  )
  assert.ok(redirect.status === "warning", JSON.stringify(redirect))
}

console.log("url checks passed")
