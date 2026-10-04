import type { MetadataRoute } from "next"

import { SITE_URL } from "@/lib/site"

// Search and AI answer-engine crawlers are welcome; API routes are not content.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
