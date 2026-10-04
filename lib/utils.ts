export { cn } from "cn"

// True while the user is typing: form fields, contenteditable text, and widgets that act as a text
// box without being one. Monaco, for example, focuses a <div role="textbox"> (the EditContext API).
// Duck-typed rather than `instanceof HTMLElement`, so it also works for events from the preview iframe.
export function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el?.closest) return false
  return (
    el.isContentEditable ||
    !!el.closest("input, textarea, select, [role=textbox], .monaco-editor")
  )
}
