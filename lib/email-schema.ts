// Zod schema for EmailDoc, derived from DEFAULTS / OPTIONS / canContain so it never drifts from the model.
// Used to constrain AI output; parseDoc stays the final check (fills defaults, assigns ids).
import { z } from "zod"
import {
  DEFAULTS,
  DEFAULT_SETTINGS,
  OPTIONS,
  canContain,
  kindOf,
  newBlock,
  type BlockType,
} from "./model"

function field(key: string, value: unknown) {
  switch (kindOf(key, value)) {
    case "number":
      return z.number().nonnegative()
    case "boolean":
      return z.boolean()
    case "color":
      return z.string().regex(/^#[0-9a-fA-F]{6}$/)
    case "select":
      return z.enum(OPTIONS[key as keyof typeof OPTIONS])
    default:
      return z.string()
  }
}

// Every field optional: the model sets what matters, parseDoc fills the rest from DEFAULTS.
const fields = (shape: object) =>
  Object.fromEntries(
    Object.entries(shape).map(([k, v]) => [k, field(k, v).optional()])
  )

const TYPES = Object.keys(DEFAULTS) as BlockType[]

// Nesting is finite (see canContain), so the tree is unrolled per parent instead of z.lazy.
// Memoized so each block schema is one instance: zodSchema(..., { useReferences: true }) emits it once.
const memo = new Map<BlockType, z.ZodObject>()
function blockOf(t: BlockType) {
  if (!memo.has(t)) {
    const shape: Record<string, z.ZodType> = {
      type: z.literal(t),
      ...fields(DEFAULTS[t]),
    }
    if (t === "columns") shape.children = z.array(blocksIn(t)).min(1).max(4)
    else if ("children" in newBlock(t)) shape.children = z.array(blocksIn(t))
    memo.set(t, z.object(shape))
  }
  return memo.get(t)!
}
const blocksIn = (parent: BlockType | null) =>
  z.discriminatedUnion(
    "type",
    TYPES.filter((t) => canContain(parent, t)).map(blockOf) as [
      z.ZodObject,
      ...z.ZodObject[],
    ]
  )

export const emailDocSchema = z.object({
  settings: z.object(fields(DEFAULT_SETTINGS)),
  blocks: z.array(blocksIn(null)),
})
