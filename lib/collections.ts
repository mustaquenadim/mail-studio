// Themed template collections, modelled on the demo emails in react-email (resend/react-email,
// apps/demo/emails): five visual themes, each with a full set of SaaS or e-commerce emails.
// Rebuilt as blocks with neutral "Acme" branding, so every template is editable here.
import {
  DEFAULT_SETTINGS,
  type Block,
  type EmailDoc,
  type OPTIONS,
} from "./email"
import { b, type Template } from "./templates"

type Font = (typeof OPTIONS)["fontFamily"][number]
type Theme = {
  id: string
  name: string
  description: string
  kind: "saas" | "shop"
  bg: string // around the email
  card: string // the email body
  panel: string // highlighted areas inside it
  fg: string
  fg2: string
  fg3: string
  stroke: string
  button: string
  buttonText: string
  heading: Font
  body: Font
  radius: number
  align: "left" | "center"
}

const THEMES: Theme[] = [
  {
    id: "barebone",
    name: "Barebone",
    description: "Clean, neutral SaaS",
    kind: "saas",
    bg: "#f3f4f6",
    card: "#ffffff",
    panel: "#f3f4f6",
    fg: "#14171e",
    fg2: "#43454b",
    fg3: "#6b6d72",
    stroke: "#e4e4e7",
    button: "#14171e",
    buttonText: "#ffffff",
    heading: "Helvetica",
    body: "Helvetica",
    radius: 8,
    align: "center",
  },
  {
    id: "matte",
    name: "Matte",
    description: "Soft green, editorial SaaS",
    kind: "saas",
    bg: "#fbfcfb",
    card: "#ffffff",
    panel: "#f1f5ef",
    fg: "#103b05",
    fg2: "#194a07",
    fg3: "#5f7558",
    stroke: "#d8e1d4",
    button: "#103b05",
    buttonText: "#fbfff9",
    heading: "Georgia",
    body: "Arial",
    radius: 999,
    align: "left",
  },
  {
    id: "protocol",
    name: "Protocol",
    description: "Dark, technical SaaS",
    kind: "saas",
    bg: "#0a0a0a",
    card: "#131313",
    panel: "#212121",
    fg: "#ffffff",
    fg2: "#c4c4c4",
    fg3: "#9a9a9a",
    stroke: "#2b2b2b",
    button: "#ffffff",
    buttonText: "#131313",
    heading: "Courier New",
    body: "Helvetica",
    radius: 0,
    align: "left",
  },
  {
    id: "arcane",
    name: "Arcane",
    description: "Deep burgundy, serif boutique",
    kind: "shop",
    bg: "#1f040a",
    card: "#300610",
    panel: "#431d26",
    fg: "#fcf3ed",
    fg2: "#efe1d8",
    fg3: "#c4aca8",
    stroke: "#5a2a35",
    button: "#f9f9ed",
    buttonText: "#300610",
    heading: "Georgia",
    body: "Helvetica",
    radius: 0,
    align: "left",
  },
  {
    id: "studio",
    name: "Studio",
    description: "Cool grey, modern store",
    kind: "shop",
    bg: "#dce1e4",
    card: "#ffffff",
    panel: "#f6f6f6",
    fg: "#332c2c",
    fg2: "#5c5555",
    fg3: "#696262",
    stroke: "#e8e9e9",
    button: "#332c2c",
    buttonText: "#ffffff",
    heading: "Arial",
    body: "Arial",
    radius: 8,
    align: "center",
  },
]

const URL = "https://example.com"
const hex = (c: string) => c.slice(1)

// Building blocks styled by the theme.
function kit(t: Theme) {
  const text = (body: string, extra: Record<string, unknown> = {}) =>
    b("text", {
      body,
      color: t.fg2,
      align: t.align,
      fontFamily: t.body,
      fontSize: 16,
      ...extra,
    })
  const small = (body: string, extra: Record<string, unknown> = {}) =>
    text(body, { color: t.fg3, fontSize: 13, ...extra })
  const image = (label: string, w: number, h: number, extra = {}) =>
    b("image", {
      src: `https://placehold.co/${w}x${h}/${hex(t.panel)}/${hex(t.fg3)}/png?text=${encodeURIComponent(label)}`,
      alt: label,
      ...extra,
    })
  const logo = (align: "left" | "center" = t.align) =>
    b("image", {
      src: `https://placehold.co/120x36/${hex(t.fg)}/${hex(t.card)}/png?text=Acme`,
      alt: "Acme",
      href: URL,
      size: 20,
      align,
    })
  return {
    text,
    small,
    image,
    title: (text: string, extra: Record<string, unknown> = {}) =>
      b("title", {
        text,
        color: t.fg,
        align: t.align,
        fontFamily: t.heading,
        fontSize: 32,
        ...extra,
      }),
    heading: (text: string, extra: Record<string, unknown> = {}) =>
      b("heading", {
        text,
        color: t.fg,
        align: t.align,
        fontFamily: t.heading,
        ...extra,
      }),
    button: (text: string, extra: Record<string, unknown> = {}) =>
      b("button", {
        text,
        href: URL,
        bg: t.button,
        color: t.buttonText,
        radius: t.radius,
        align: t.align,
        fontFamily: t.body,
        fontSize: 15,
        ...extra,
      }),
    divider: () => b("divider", { color: t.stroke }),
    spacer: (height = 16) => b("spacer", { height }),
    list: (items: string[]) =>
      b("bulletList", {
        items: items.join("\n"),
        color: t.fg2,
        fontFamily: t.body,
      }),
    // "Label | value" rows, e.g. order totals or plan details.
    table: (rows: [string, string][]) =>
      b("table", {
        rows: rows.map((r) => r.join(" | ")).join("\n"),
        header: false,
        color: t.fg2,
        borderColor: t.stroke,
        cellPadding: 12,
        fontFamily: t.body,
      }),
    header: () => b("section", { bg: t.card, padding: 32 }, [logo()]),
    // The highlighted area most templates put their message in.
    panel: (children: Block[]) =>
      b("section", { bg: t.panel, padding: 40 }, children),
    body: (children: Block[]) =>
      b("section", { bg: t.card, padding: 32 }, children),
    product: (name: string, detail: string, price: string) =>
      b("columns", { gap: 24, stackOnMobile: false }, [
        b("column", {}, [image(name, 240, 240, { size: 60, align: "left" })]),
        b("column", {}, [
          b("heading", {
            text: name,
            color: t.fg,
            fontFamily: t.heading,
          }),
          small(detail, { align: "left" }),
          text(price, { align: "left", color: t.fg }),
        ]),
      ]),
    footer: () =>
      b("section", { bg: t.card, padding: 32 }, [
        b("divider", { color: t.stroke }),
        small("Acme makes everyday work a little easier.", {
          align: "center",
        }),
        b("social", {
          networks: "x | https://x.com\nlinkedin | https://linkedin.com",
          iconSize: 20,
          align: "center",
        }),
        small(
          'Acme Inc., 123 Market Street, San Francisco, CA\n<a href="https://example.com/preferences">Email preferences</a> · <a href="https://example.com/unsubscribe">Unsubscribe</a>',
          { align: "center", fontSize: 12 }
        ),
      ]),
  }
}
type Kit = ReturnType<typeof kit>

type Email = {
  id: string
  name: string
  kinds: Theme["kind"][]
  subject: string
  preview: string
  blocks: (k: Kit, t: Theme) => Block[]
}

const EMAILS: Email[] = [
  {
    id: "welcome",
    name: "Welcome",
    kinds: ["saas", "shop"],
    subject: "Welcome to Acme",
    preview: "Your account is ready. Here's where to start.",
    blocks: (k, t) => [
      k.header(),
      k.panel(
        t.kind === "shop"
          ? [
              k.title("Welcome to Acme"),
              k.text(
                "Thanks for joining. As a member you get early access to new releases, free shipping on orders over $50, and 10% off your first order."
              ),
              k.text("Use code <b>WELCOME10</b> at checkout."),
              k.spacer(8),
              k.button("Start shopping"),
            ]
          : [
              k.title("Welcome to Acme"),
              k.text(
                "Your account is ready. Here are three things that help new teams get going in their first week:"
              ),
              k.list([
                "Create your first project",
                "Invite your teammates",
                "Connect the tools you already use",
              ]),
              k.spacer(8),
              k.button("Open your dashboard"),
            ]
      ),
      k.body([
        k.small(
          'Questions? Reply to this email or visit the <a href="https://example.com/help">help center</a>.'
        ),
      ]),
      k.footer(),
    ],
  },
  {
    id: "activation",
    name: "Activate account",
    kinds: ["saas", "shop"],
    subject: "Confirm your email address",
    preview: "One click to activate your Acme account.",
    blocks: (k) => [
      k.header(),
      k.panel([
        k.title("Confirm your email"),
        k.text(
          "Click the button below to confirm this address and activate your account."
        ),
        k.spacer(8),
        k.button("Activate account"),
        k.spacer(8),
        k.small("Or enter this code in the app:"),
        k.title("482 913", { fontSize: 28 }),
        k.small(
          "This link and code expire in 24 hours. If you didn't create an account, you can ignore this email."
        ),
      ]),
      k.footer(),
    ],
  },
  {
    id: "password-reset",
    name: "Password reset",
    kinds: ["saas", "shop"],
    subject: "Reset your password",
    preview: "Use this link to choose a new password.",
    blocks: (k) => [
      k.header(),
      k.panel([
        k.title("Reset your password"),
        k.text(
          "We received a request to reset the password for your account. Use the button below to choose a new one."
        ),
        k.spacer(8),
        k.button("Choose a new password"),
        k.spacer(8),
        k.small(
          "This link expires in 1 hour. If you didn't ask for a reset, ignore this email: your password stays the same until you create a new one."
        ),
      ]),
      k.footer(),
    ],
  },
  {
    id: "feature-announcement",
    name: "Feature announcement",
    kinds: ["saas"],
    subject: "Introducing Workflows",
    preview: "Automate the busywork. Available today on every plan.",
    blocks: (k) => [
      k.header(),
      k.body([
        k.small("NEW FEATURE"),
        k.title("Introducing Workflows"),
        k.text(
          "Automate the repetitive parts of your day. Workflows run on a schedule or a trigger, and they're available today on every plan."
        ),
        k.image("Workflows", 1200, 600),
        k.list([
          "<b>Triggers</b>: start from any event in your workspace",
          "<b>Steps</b>: chain actions with branches and approvals",
          "<b>History</b>: see every run, with logs you can share",
        ]),
        k.button("Try Workflows"),
      ]),
      k.footer(),
    ],
  },
  {
    id: "product-update",
    name: "Product update",
    kinds: ["saas"],
    subject: "What's new in Acme: March",
    preview: "Faster search, a new API, and a dozen fixes.",
    blocks: (k) => [
      k.header(),
      k.body([
        k.small("MARCH UPDATE"),
        k.title("What's new in Acme"),
        k.text("Here's everything we shipped this month."),
        k.divider(),
        k.heading("Search is 3× faster"),
        k.text(
          "Results now appear as you type, even in workspaces with millions of records."
        ),
        k.image("Search", 1200, 500),
        k.divider(),
        k.heading("A new REST API"),
        k.text(
          "Versioned endpoints, cursor pagination and webhooks for every event. Read the docs to get started."
        ),
        k.button("Read the changelog"),
      ]),
      k.footer(),
    ],
  },
  {
    id: "subscription-confirmation",
    name: "Subscription confirmed",
    kinds: ["saas"],
    subject: "You're on Acme Pro",
    preview: "Thanks for subscribing. Here are your plan details.",
    blocks: (k) => [
      k.header(),
      k.panel([
        k.title("You're on Acme Pro"),
        k.text(
          "Thanks for subscribing. Your new features are unlocked and ready to use."
        ),
        k.table([
          ["Plan", "Pro"],
          ["Billing", "Monthly"],
          ["Amount", "$20.00 / month"],
          ["Next payment", "April 12"],
        ]),
        k.spacer(8),
        k.button("Manage subscription"),
      ]),
      k.footer(),
    ],
  },
  {
    id: "subscription-update",
    name: "Subscription changed",
    kinds: ["saas"],
    subject: "Your plan has changed",
    preview: "Your subscription was updated to the Team plan.",
    blocks: (k) => [
      k.header(),
      k.panel([
        k.title("Your plan has changed"),
        k.text(
          "Your subscription was updated. The change takes effect immediately and is prorated on your next invoice."
        ),
        k.table([
          ["Previous plan", "Pro · $20 / month"],
          ["New plan", "Team · $60 / month"],
          ["Seats", "5"],
          ["Effective", "Today"],
        ]),
        k.spacer(8),
        k.button("View billing"),
        k.small("Didn't make this change? Contact support right away."),
      ]),
      k.footer(),
    ],
  },
  {
    id: "text-only",
    name: "Text only",
    kinds: ["saas"],
    subject: "A quick note from our founder",
    preview: "Thank you for being one of our first customers.",
    blocks: (k) => [
      k.body([
        k.text("Hi there,", { align: "left" }),
        k.text(
          "I wanted to write personally to say thank you. You were one of the first teams to try Acme, and your feedback shaped almost everything we've built since.",
          { align: "left" }
        ),
        k.text(
          "If there's anything we can do better, just reply. Every email comes straight to me.",
          { align: "left" }
        ),
        k.text("Thanks,\nJordan\nFounder, Acme", { align: "left" }),
      ]),
      k.body([
        k.small(
          '<a href="https://example.com/unsubscribe">Unsubscribe</a> · Acme Inc., 123 Market Street, San Francisco, CA',
          { align: "left", fontSize: 12 }
        ),
      ]),
    ],
  },
  {
    id: "newsletter",
    name: "Newsletter",
    kinds: ["shop"],
    subject: "The spring edit",
    preview: "New arrivals, a behind-the-scenes story and a reader favourite.",
    blocks: (k) => [
      k.header(),
      k.image("The spring edit", 1200, 700),
      k.body([
        k.small("ISSUE 12 · SPRING"),
        k.title("The spring edit"),
        k.text(
          "Lighter textures, brighter colours and a few things we've been waiting all winter to show you."
        ),
        k.button("Shop new arrivals"),
        k.divider(),
        b("columns", { gap: 24 }, [
          b("column", {}, [
            k.image("Story", 600, 400),
            k.heading("Behind the studio"),
            k.text("How one small workshop makes every piece by hand.", {
              align: "left",
            }),
          ]),
          b("column", {}, [
            k.image("Favourite", 600, 400),
            k.heading("Reader favourite"),
            k.text("The bestseller you keep asking us to restock is back.", {
              align: "left",
            }),
          ]),
        ]),
      ]),
      k.footer(),
    ],
  },
  {
    id: "order-confirmation",
    name: "Order confirmation",
    kinds: ["shop"],
    subject: "Your order #10482 is confirmed",
    preview: "Thanks for your order. We'll email you when it ships.",
    blocks: (k) => [
      k.header(),
      k.body([
        k.title("Your order is confirmed"),
        k.text(
          "Thanks for shopping with us. We'll send tracking details as soon as order #10482 leaves the warehouse, usually within one business day."
        ),
        k.button("View order"),
        k.divider(),
        k.product("Daily Serum", "Qty 1 · 30 ml", "$64.00"),
        k.product("Night Cream", "Qty 1 · 50 ml", "$72.00"),
        k.divider(),
        k.table([
          ["Subtotal", "$136.00"],
          ["Shipping", "Free"],
          ["Tax", "$10.88"],
          ["Total", "$146.88"],
        ]),
      ]),
      k.footer(),
    ],
  },
  {
    id: "order-shipping",
    name: "Order shipped",
    kinds: ["shop"],
    subject: "Your order is on its way",
    preview: "Order #10482 has shipped. Track it here.",
    blocks: (k) => [
      k.header(),
      k.panel([
        k.title("Your order is on its way"),
        k.text("Order #10482 left our warehouse today."),
        k.table([
          ["Carrier", "UPS"],
          ["Tracking number", "1Z 999 AA1 01 2345 6784"],
          ["Estimated delivery", "Thursday, March 14"],
        ]),
        k.spacer(8),
        k.button("Track package"),
      ]),
      k.body([
        k.heading("Shipping to"),
        k.text("Alex Morgan\n42 Elm Street\nPortland, OR 97201", {
          align: "left",
        }),
        k.divider(),
        k.product("Daily Serum", "Qty 1", "$64.00"),
        k.product("Night Cream", "Qty 1", "$72.00"),
      ]),
      k.footer(),
    ],
  },
  {
    id: "abandoned-cart",
    name: "Abandoned cart",
    kinds: ["shop"],
    subject: "You left something behind",
    preview: "Your cart is saved. Complete your order before it sells out.",
    blocks: (k) => [
      k.header(),
      k.body([
        k.title("You left something behind"),
        k.text(
          "We saved the items in your cart. Stock is limited, so complete your order while they're still available."
        ),
        k.product("Daily Serum", "Qty 1 · 30 ml", "$64.00"),
        k.product("Body Oil", "Qty 1 · 100 ml", "$38.00"),
        k.divider(),
        k.button("Return to cart"),
        k.small("Need help deciding? Reply and our team will help."),
      ]),
      k.footer(),
    ],
  },
  {
    id: "promo",
    name: "Promotion",
    kinds: ["shop"],
    subject: "25% off everything, this weekend only",
    preview: "Use code SPRING25 at checkout. Ends Sunday at midnight.",
    blocks: (k, t) => [
      k.header(),
      b("hero", { bg: t.panel, bgImage: "", height: 320, padding: 40 }, [
        k.small("THIS WEEKEND ONLY", { align: "center" }),
        k.title("25% off everything", { align: "center", fontSize: 44 }),
        k.text("Use code <b>SPRING25</b> at checkout.", { align: "center" }),
        k.button("Shop the sale", { align: "center" }),
      ]),
      k.body([
        b("columns", { gap: 16 }, [
          b("column", {}, [k.image("Serum", 400, 400)]),
          b("column", {}, [k.image("Cream", 400, 400)]),
          b("column", {}, [k.image("Oil", 400, 400)]),
        ]),
        k.small(
          "Ends Sunday at 11:59pm PT. Can't be combined with other offers.",
          { align: "center" }
        ),
      ]),
      k.footer(),
    ],
  },
]

export type Collection = {
  id: string
  name: string
  description: string
  swatch: [string, string]
  templates: Template[]
}

export const COLLECTIONS: Collection[] = THEMES.map((t) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  swatch: [t.card, t.fg],
  templates: EMAILS.filter((e) => e.kinds.includes(t.kind)).map((e) => ({
    id: `${t.id}-${e.id}`,
    name: e.name,
    category: t.name,
    build: (): EmailDoc => ({
      settings: {
        ...DEFAULT_SETTINGS,
        subject: e.subject,
        preview: e.preview,
        bg: t.bg,
        contentBg: t.card,
      },
      blocks: e.blocks(kit(t), t),
    }),
  })),
}))
