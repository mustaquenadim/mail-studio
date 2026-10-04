// Canonical origin for metadata, robots and sitemap.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")

export const SITE_NAME = "Mail Studio"

export const SITE_DESCRIPTION =
  "Free visual email builder. Design responsive HTML emails with drag-and-drop blocks, generate templates with AI, check email client compatibility, export to HTML, MJML or Markdown, and send test emails over SMTP."
