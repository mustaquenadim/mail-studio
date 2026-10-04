import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ClarityInit } from "@/components/clarity"
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME}: Free Visual HTML Email Builder`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Mustaque Nadim", url: "https://mustaquenadim.com" }],
  creator: "Mustaque Nadim",
  keywords: [
    "email builder",
    "HTML email editor",
    "responsive email templates",
    "drag and drop email designer",
    "AI email template generator",
    "MJML editor",
    "email client compatibility",
    "test email sender",
  ],
  category: "technology",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

// Structured data for search engines and AI answer engines.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any (web browser)",
      browserRequirements: "Requires JavaScript",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      author: {
        "@type": "Person",
        name: "Mustaque Nadim",
        url: "https://mustaquenadim.com",
      },
      featureList: [
        "Drag-and-drop email blocks and multi-column layouts",
        "AI email template generation",
        "Desktop, tablet and mobile previews",
        "Email client compatibility checks (caniemail.com data)",
        "Broken link checks",
        "Export to HTML, MJML and Markdown",
        "Send test emails via SMTP or Resend",
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        [
          "What is Mail Studio?",
          "A free, browser-based visual builder for designing responsive HTML emails with drag-and-drop blocks.",
        ],
        [
          "Is Mail Studio free?",
          "Yes. It runs in the browser with no sign-up, and your work is saved locally.",
        ],
        [
          "Can I export my email as HTML?",
          "Yes. Emails export as inline-styled HTML, MJML or Markdown, and can be imported from the same formats.",
        ],
        [
          "Will my email render correctly in Outlook and Gmail?",
          "The built-in compatibility check uses caniemail.com data to flag HTML and CSS features that major email clients do not support.",
        ],
        [
          "Can I send a test email?",
          "Yes. Send to a test inbox, through any SMTP server such as Gmail, Outlook, SendGrid or Mailgun, or via Resend.",
        ],
      ].map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable
      )}
    >
      <body>
        <script
          type="application/ld+json"
          // Static data, but escape "<" per the Next.js JSON-LD guide.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <ClarityInit />
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
