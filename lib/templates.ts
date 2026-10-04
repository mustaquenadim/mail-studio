import {
  allBlocks,
  canContain,
  DEFAULT_SETTINGS,
  isContainer,
  newBlock,
  type Block,
  type BlockType,
  type EmailDoc,
  type Settings,
} from "./email"

// Builds a block from defaults plus overrides. Built fresh on every call, so ids never repeat.
export function b(
  type: BlockType,
  fields: Record<string, unknown> = {},
  children?: Block[]
): Block {
  const out = { ...newBlock(type), ...fields } as Record<string, unknown>
  if (children) out.children = children
  return out as Block
}
const doc = (settings: Partial<Settings>, blocks: Block[]): EmailDoc => ({
  settings: { ...DEFAULT_SETTINGS, ...settings },
  blocks,
})
const UNSUBSCRIBE =
  'You received this because you signed up. <a href="https://example.com/unsubscribe">Unsubscribe</a>'

export type Template = {
  id: string
  name: string
  category: string
  build: () => EmailDoc
}

export const TEMPLATES: Template[] = [
  {
    id: "welcome",
    name: "Welcome Email",
    category: "welcome",
    build: () =>
      doc(
        { subject: "Welcome aboard", preview: "Here's how to get started." },
        [
          b("title", { text: "Welcome aboard 👋" }),
          b("text", {
            body: "Thanks for signing up. Your account is ready, and the next step takes about two minutes.",
          }),
          b("button", { text: "Get started", bg: "#111111", align: "left" }),
          b("text", {
            body: "Questions? Just reply to this email.",
            color: "#71717a",
            fontSize: 14,
          }),
          b("social", {
            networks: "github | https://github.com",
            align: "left",
          }),
        ]
      ),
  },
  {
    id: "newsletter",
    name: "Newsletter",
    category: "newsletter",
    build: () =>
      doc(
        {
          subject: "This week's update",
          preview: "Three things worth reading.",
        },
        [
          b("section", { bg: "#18181b", padding: 24 }, [
            b("title", {
              text: "The Weekly",
              color: "#ffffff",
              align: "center",
            }),
          ]),
          b("image", {
            src: "https://placehold.co/600x300/png?text=Featured",
            alt: "Featured story",
          }),
          b("heading", { text: "Our featured story" }),
          b("text", {
            body: "A short summary of the story that makes people want to read the rest of it.",
          }),
          b("button", { text: "Read more", align: "left" }),
          b("divider"),
          b("text", {
            body: UNSUBSCRIBE,
            color: "#71717a",
            fontSize: 12,
            align: "center",
          }),
        ]
      ),
  },
  {
    id: "marketing",
    name: "Marketing Promo",
    category: "marketing",
    build: () =>
      doc(
        {
          subject: "20% off this week",
          preview: "Use code SAVE20 at checkout.",
        },
        [
          b(
            "hero",
            {
              bg: "#4f46e5",
              bgImage: "",
              height: 260,
            },
            [
              b("title", {
                text: "The big sale",
                color: "#ffffff",
                align: "center",
              }),
              b("text", {
                body: "Everything is 20% off until Sunday.",
                color: "#e0e7ff",
                align: "center",
              }),
              b("button", {
                text: "Shop now",
                bg: "#ffffff",
                color: "#4f46e5",
              }),
            ]
          ),
          b("section", { bg: "#eef2ff", padding: 24 }, [
            b("heading", {
              text: "Use code SAVE20",
              align: "center",
              color: "#3730a3",
            }),
            b("text", {
              body: "Enter it at checkout. One use per customer.",
              align: "center",
            }),
          ]),
          b("text", {
            body: UNSUBSCRIBE,
            color: "#71717a",
            fontSize: 12,
            align: "center",
          }),
        ]
      ),
  },
  {
    id: "notification",
    name: "Account Notification",
    category: "notification",
    build: () =>
      doc({ subject: "Your password was changed" }, [
        b("heading", { text: "Your password was changed" }),
        b("divider"),
        b("text", {
          body: "The password for your account was changed just now. If this was you, there's nothing else to do.",
        }),
        b("button", { text: "Review account activity", align: "left" }),
        b("text", {
          body: "If you didn't change it, reset your password right away.",
          color: "#71717a",
          fontSize: 14,
        }),
      ]),
  },
  {
    id: "locked-template",
    name: "Locked Template",
    category: "newsletter",
    build: () =>
      doc({ subject: "Company update" }, [
        b("section", { bg: "#18181b", padding: 24, locked: true }, [
          b("title", {
            text: "Company Update",
            color: "#ffffff",
            align: "center",
          }),
        ]),
        b("heading", { text: "Write your headline" }),
        b("text", {
          body: "Edit this part. The header and footer are locked.",
        }),
        b("spacer", { height: 16 }),
        b("button", { text: "Call to action" }),
        b("section", { bg: "#18181b", padding: 24, locked: true }, [
          b("text", {
            body: '© Company. <a href="https://example.com/unsubscribe">Unsubscribe</a>',
            color: "#a1a1aa",
            fontSize: 12,
            align: "center",
          }),
        ]),
      ]),
  },
]

// --- Layouts: locked header/footer around a "main" slot section that holds your content. ---

export type Layout = {
  id: string
  name: string
  category: string
  colors: { bg: string; accent: string }
  settings: Partial<Settings>
  build: (content: Block[]) => Block[]
}

const slot = (bg: string, content: Block[]) =>
  b("section", { bg, padding: 24, slot: "main" }, content)

export const LAYOUTS: Layout[] = [
  {
    id: "sunrise",
    name: "Sunrise",
    category: "business",
    colors: { bg: "#fef5ef", accent: "#7c4a2d" },
    settings: { bg: "#fef5ef", contentBg: "#ffffff" },
    build: (content) => [
      b("section", { bg: "#fef5ef", padding: 24, locked: true }, [
        b("title", { text: "Sunrise Co.", color: "#7c4a2d", align: "center" }),
      ]),
      slot("#ffffff", content),
      b("section", { bg: "#fef5ef", padding: 24, locked: true }, [
        b("text", {
          body: UNSUBSCRIBE,
          color: "#7c4a2d",
          fontSize: 12,
          align: "center",
        }),
      ]),
    ],
  },
  {
    id: "minimal",
    name: "Modern Minimal",
    category: "creative",
    colors: { bg: "#ffffff", accent: "#000000" },
    settings: { bg: "#ffffff", contentBg: "#ffffff" },
    build: (content) => [
      b("section", { bg: "#ffffff", padding: 24, locked: true }, [
        b("heading", { text: "STUDIO", color: "#000000" }),
        b("divider", { color: "#000000", thickness: 2 }),
      ]),
      slot("#ffffff", content),
      b("section", { bg: "#ffffff", padding: 24, locked: true }, [
        b("divider", { color: "#000000", thickness: 2 }),
        b("text", { body: UNSUBSCRIBE, color: "#52525b", fontSize: 12 }),
      ]),
    ],
  },
  {
    id: "luxe",
    name: "Luxe Dark",
    category: "marketing",
    colors: { bg: "#0b0b0b", accent: "#e2b96f" },
    settings: { bg: "#0b0b0b", contentBg: "#141414" },
    build: (content) => [
      b("section", { bg: "#141414", padding: 24, locked: true }, [
        b("columns", {}, [
          b("column", {}, [
            b("heading", {
              text: "LUXE",
              color: "#e2b96f",
              fontFamily: "Georgia",
            }),
          ]),
          b("column", {}, [
            b("text", {
              body: "Issue No. 1",
              color: "#e2b96f",
              align: "right",
              fontFamily: "Georgia",
            }),
          ]),
        ]),
        b("divider", { color: "#e2b96f" }),
      ]),
      slot("#141414", content),
      b("section", { bg: "#141414", padding: 24, locked: true }, [
        b("divider", { color: "#e2b96f" }),
        b("text", {
          body: UNSUBSCRIBE,
          color: "#a1a1aa",
          fontSize: 12,
          align: "center",
          fontFamily: "Georgia",
        }),
      ]),
    ],
  },
]

const SAMPLE = () => [
  b("heading", { text: "Your headline" }),
  b("text", {
    body: "Your content goes here. The header and footer are locked.",
  }),
  b("button", { text: "Call to action" }),
]

// The slot section a layout put the content in, if there is one.
export const slotOf = (blocks: Block[]) =>
  allBlocks(blocks).find((x) => x.slot === "main" && isContainer(x))

// A slot is a section, so lift out anything a section can't hold (sections, wrappers, heroes).
const fit = (blocks: Block[]): Block[] =>
  blocks.flatMap((x) =>
    canContain("section", x.type) ? [x] : isContainer(x) ? fit(x.children) : []
  )

// Apply (or switch to) a layout. With a layout already active, its slot content carries over;
// otherwise the whole email becomes the content. `replace` starts from sample content instead.
export function applyLayout(
  d: EmailDoc,
  id: string,
  replace = false
): EmailDoc {
  const layout = LAYOUTS.find((l) => l.id === id)
  if (!layout) return d
  const current = slotOf(d.blocks)
  const content = replace
    ? SAMPLE()
    : fit(current && isContainer(current) ? current.children : d.blocks)
  return {
    settings: { ...d.settings, ...layout.settings, layout: id },
    blocks: layout.build(content),
  }
}

// Keep everything, but unlocked and no longer tied to a layout.
export function detachLayout(d: EmailDoc): EmailDoc {
  const strip = (blocks: Block[]): Block[] =>
    blocks.map((x) => {
      const { locked: _l, slot: _s, ...rest } = x
      void _l
      void _s
      const out = rest as Block
      if (isContainer(out)) out.children = strip(out.children)
      return out
    })
  return {
    settings: { ...d.settings, layout: "" },
    blocks: strip(d.blocks),
  }
}
