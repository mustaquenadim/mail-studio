import { useCallback, useRef, useState } from "react"

const LIMIT = 50
// Edits with the same key this close together (typing in one field) become one undo step.
const MERGE_MS = 600

type State<T> = { past: T[]; now: T; future: T[] }

// Undo/redo over an immutable value. `set` ignores updates that return the same value.
export function useHistory<T>(initial: T) {
  const [h, setH] = useState<State<T>>({ past: [], now: initial, future: [] })
  const last = useRef({ key: "", at: 0 })

  const set = useCallback((f: T | ((now: T) => T), key = "") => {
    const t = Date.now()
    const merge =
      key !== "" && key === last.current.key && t - last.current.at < MERGE_MS
    last.current = { key, at: t }
    setH((h) => {
      const now = typeof f === "function" ? (f as (now: T) => T)(h.now) : f
      if (now === h.now) return h
      return {
        past: merge ? h.past : [...h.past, h.now].slice(-LIMIT),
        now,
        future: [],
      }
    })
  }, [])

  const undo = useCallback(() => {
    last.current.key = ""
    setH((h) =>
      h.past.length
        ? {
            past: h.past.slice(0, -1),
            now: h.past[h.past.length - 1],
            future: [h.now, ...h.future],
          }
        : h
    )
  }, [])

  const redo = useCallback(() => {
    last.current.key = ""
    setH((h) =>
      h.future.length
        ? {
            past: [...h.past, h.now],
            now: h.future[0],
            future: h.future.slice(1),
          }
        : h
    )
  }, [])

  // Replace without an undo step (e.g. loading the saved draft).
  const reset = useCallback((now: T) => setH({ past: [], now, future: [] }), [])

  return {
    value: h.now,
    set,
    undo,
    redo,
    reset,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
  }
}
