"use client"

import { useSyncExternalStore } from "react"

// Code editor preferences, shared by every Monaco instance and the settings dialog. Lives outside
// components/monaco.tsx because importing that file pulls Monaco (and `window`) into the page.
export type EditorPrefs = {
  fontSize: number
  wordWrap: boolean
  minimap: boolean
}

export const EDITOR_DEFAULTS: EditorPrefs = {
  fontSize: 12,
  wordWrap: true,
  minimap: false,
}

const KEY = "email-builder:editor"
const listeners = new Set<() => void>()
let cache: EditorPrefs | null = null

function read(): EditorPrefs {
  if (cache) return cache
  let saved: Partial<EditorPrefs> = {}
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}")
    if (v && typeof v === "object") saved = v
  } catch {}
  cache = {
    fontSize:
      typeof saved.fontSize === "number"
        ? saved.fontSize
        : EDITOR_DEFAULTS.fontSize,
    wordWrap:
      typeof saved.wordWrap === "boolean"
        ? saved.wordWrap
        : EDITOR_DEFAULTS.wordWrap,
    minimap:
      typeof saved.minimap === "boolean"
        ? saved.minimap
        : EDITOR_DEFAULTS.minimap,
  }
  return cache
}

export function setEditorPrefs(patch: Partial<EditorPrefs>) {
  cache = { ...read(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {}
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export const useEditorPrefs = () =>
  useSyncExternalStore(subscribe, read, () => EDITOR_DEFAULTS)
