import { ImageResponse } from "next/og"

import { SITE_NAME } from "@/lib/site"

export const alt = `${SITE_NAME}: visual HTML email builder`
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: "#0a0a0a",
        color: "#fafafa",
      }}
    >
      <div style={{ fontSize: 88, fontWeight: 700 }}>{SITE_NAME}</div>
      <div style={{ fontSize: 40, marginTop: 24, color: "#a3a3a3" }}>
        Design, check and send responsive HTML emails
      </div>
    </div>,
    size
  )
}
