// Generates or edits an email doc from a prompt. The model's output is constrained by emailDocSchema
// (typed structured output), then re-checked by parseDoc, which fills defaults and assigns ids.
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateText, Output, zodSchema } from "ai"
import { DEFAULTS, parseDoc } from "@/lib/model"
import { emailDocSchema } from "@/lib/email-schema"

export const maxDuration = 120

const fail = (error: string, status = 400) =>
  Response.json({ error }, { status })

const SYSTEM = `You design HTML emails for an email builder. Output an email document as JSON.
Blocks and their default fields (omit a field to keep its default):
${JSON.stringify(DEFAULTS)}
Rules:
- Nesting: top level holds anything except "column". "wrapper" holds only "section"/"hero". "section" holds anything but "section"/"wrapper"/"hero". "columns" holds 1-4 "column", which hold only non-container blocks. "hero" holds only non-container blocks.
- Colors are #rrggbb. List-like fields are newline-separated; links are "Label | url" per line.
- Text fields may use <b> <i> <u> <s> <a href="..."> and "\\n" for line breaks.
- Images: use https://placehold.co/WIDTHxHEIGHT/png placeholders unless the user gives URLs.
- Always set settings.subject and settings.preview. Write real, specific copy, not lorem ipsum.`

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return fail("Expected a JSON body.", 415)

  const body = (await request.json().catch(() => null)) as {
    prompt?: unknown
    doc?: unknown
    apiKey?: unknown
    model?: unknown
  } | null
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : ""
  if (!prompt || prompt.length > 4000)
    return fail("Describe the email (up to 4000 characters).")
  const model =
    typeof body?.model === "string" && body.model
      ? body.model
      : process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5.5"
  if (!/^[\w.-]+\/[\w.:-]+$/.test(model))
    return fail(
      "Enter an OpenRouter model id like anthropic/claude-sonnet-5.5."
    )

  // The user's own key works anywhere; the server's key is dev-only.
  const userKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : ""
  // ponytail: server key is dev-only, so a deployed copy doesn't spend your credits for strangers. Add auth to allow it in production.
  const apiKey =
    userKey ||
    (process.env.NODE_ENV !== "production" && process.env.OPENROUTER_API_KEY)
  if (!apiKey) return fail("Add your OpenRouter API key in Settings.", 401)

  try {
    const { output } = await generateText({
      // Any OpenRouter model id that supports structured outputs.
      model: createOpenRouter({ apiKey })(model),
      system: SYSTEM,
      prompt: body?.doc
        ? `Current email:\n${JSON.stringify(body.doc)}\n\nChange it as follows, keeping everything else: ${prompt}`
        : prompt,
      output: Output.object({
        schema: zodSchema(emailDocSchema, { useReferences: true }),
      }),
    })
    const doc = parseDoc(JSON.stringify(output))
    if (!doc) return fail("The AI returned an invalid email. Try again.", 422)
    return Response.json({ doc })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Generation failed.", 502)
  }
}
