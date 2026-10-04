"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { isTypingTarget } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tip } from "@/components/tip"

function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      <ThemeHotkey />
      {children}
    </NextThemesProvider>
  )
}

function ThemeHotkey() {
  const { resolvedTheme, setTheme } = useTheme()

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (event.key.toLowerCase() !== "d") {
        return
      }

      if (isTypingTarget(event.target)) {
        return
      }

      setTheme(resolvedTheme === "dark" ? "light" : "dark")
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [resolvedTheme, setTheme])

  return null
}

// Icons swap via the `dark` class so server and client markup match before the theme resolves.
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Tip label="Toggle theme (D)" side="bottom">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Toggle theme"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        <Sun className="dark:hidden" />
        <Moon className="hidden dark:block" />
      </Button>
    </Tip>
  )
}

export { ThemeProvider, ThemeToggle }
