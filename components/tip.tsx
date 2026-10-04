"use client"

import type { ReactElement, ReactNode } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Hover/focus helper text for a single element (rendered as the trigger itself).
export function Tip({
  label,
  side,
  children,
}: {
  label: ReactNode
  side?: "top" | "bottom" | "left" | "right"
  children: ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
