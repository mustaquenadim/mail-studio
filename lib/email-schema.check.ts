// Run: pnpm dlx tsx lib/email-schema.check.ts
// Every built-in template must satisfy the AI schema, proving it matches the doc model.
import assert from "node:assert/strict"
import { z } from "zod"
import { emailDocSchema } from "./email-schema"
import { TEMPLATES } from "./templates"
import { COLLECTIONS } from "./collections"

for (const t of [...TEMPLATES, ...COLLECTIONS.flatMap((c) => c.templates)]) {
  const r = emailDocSchema.safeParse(t.build())
  assert.ok(r.success, `template ${t.id}: ${r.error?.message}`)
}
assert.ok(
  !emailDocSchema.safeParse({
    settings: {},
    blocks: [{ type: "column", children: [] }],
  }).success,
  "column only inside columns"
)
assert.ok(
  !emailDocSchema.safeParse({
    settings: {},
    blocks: [{ type: "button", bg: "red" }],
  }).success,
  "colors are hex"
)
console.log(
  "schema ok, JSON schema size:",
  JSON.stringify(z.toJSONSchema(emailDocSchema, { reused: "ref" })).length
)
