"use client"

// Monaco, bundled with the app instead of loaded from a CDN. Import this with next/dynamic and
// ssr: false: Monaco touches `window` as soon as it loads.
import { createElement, useEffect, useRef, type ComponentType } from "react"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import * as ReactEmail from "react-email"
import Editor, { loader } from "@monaco-editor/react"
import * as monaco from "monaco-editor"
import { useTheme } from "next-themes"
import { useEditorPrefs } from "@/lib/editor-prefs"

// Each `new Worker(new URL(...))` is written out in full: that exact form is what makes the bundler
// build the worker with its imports. Building the URL first leaves it a bare file whose imports 404.
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json")
      return new Worker(
        new URL("monaco-editor/language/json/json.worker.js", import.meta.url),
        { type: "module" }
      )
    if (label === "html")
      return new Worker(
        new URL("monaco-editor/language/html/html.worker.js", import.meta.url),
        { type: "module" }
      )
    if (label === "typescript" || label === "javascript")
      return new Worker(
        new URL(
          "monaco-editor/language/typescript/ts.worker.js",
          import.meta.url
        ),
        { type: "module" }
      )
    return new Worker(
      new URL("monaco-editor/editor/editor.worker.js", import.meta.url),
      { type: "module" }
    )
  },
}
loader.config({ monaco })
// The React tab is generated source that imports packages Monaco can't see; only flag syntax errors.
monaco.typescript.typescriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: true,
})
// Settings for compiling the React tab when it is applied (see reactToHtml).
monaco.typescript.typescriptDefaults.setCompilerOptions({
  jsx: monaco.typescript.JsxEmit.React,
  module: monaco.typescript.ModuleKind.CommonJS,
  target: monaco.typescript.ScriptTarget.ES2020,
  allowNonTsExtensions: true,
})

// Monaco sets up its TypeScript service only after the first TypeScript model exists, and does it
// asynchronously; until then getTypeScriptWorker rejects with "TypeScript not registered!".
async function typeScriptWorker(uri: monaco.Uri) {
  for (let tries = 0; ; tries++) {
    try {
      return await (
        await monaco.typescript.getTypeScriptWorker()
      )(uri)
    } catch (e) {
      if (String(e) !== "TypeScript not registered!") throw e
      if (tries >= 50)
        throw new Error("The TypeScript service didn't start. Try again.")
      await new Promise((r) => setTimeout(r, 100))
    }
  }
}

// Compiles the React tab with Monaco's TypeScript worker, runs it, and renders its default export.
// It runs the author's own code in this page, like any playground; it can only import react / react-email.
export async function reactToHtml(src: string): Promise<string> {
  const uri = monaco.Uri.parse("file:///apply-email.tsx")
  monaco.editor.getModel(uri)?.dispose()
  const model = monaco.editor.createModel(src, "typescript", uri)
  try {
    const worker = await typeScriptWorker(uri)
    const syntax = await worker.getSyntacticDiagnostics(uri.toString())
    if (syntax.length)
      throw new Error(
        typeof syntax[0].messageText === "string"
          ? syntax[0].messageText
          : syntax[0].messageText.messageText
      )
    // A just-started worker can emit nothing until it has synced the new model; give it a moment.
    let js: string | undefined
    for (let tries = 0; !js && tries < 30; tries++) {
      if (tries) await new Promise((r) => setTimeout(r, 100))
      const out = await worker.getEmitOutput(uri.toString())
      js = out.outputFiles[0]?.text
    }
    if (!js) throw new Error("Couldn't compile the code. Try again.")
    const modules: Record<string, unknown> = {
      react: React,
      "react-email": ReactEmail,
    }
    const exports: { default?: ComponentType } = {}
    const require = (name: string) => {
      if (name in modules) return modules[name]
      throw new Error(
        `Only "react" and "react-email" can be imported (got "${name}").`
      )
    }
    new Function("require", "exports", "React", js)(require, exports, React)
    if (typeof exports.default !== "function")
      throw new Error("Export the email as the default export.")
    return renderToStaticMarkup(createElement(exports.default))
  } finally {
    model.dispose()
  }
}

// Uncontrolled while typing: feeding every keystroke back through `value` lets a late React update
// overwrite newer keystrokes. `value` is pushed into the editor only when there are no unapplied
// edits (`dirty` false), e.g. after Apply, Reset, or an edit made in another mode.
export default function CodeEditor({
  value,
  dirty,
  language,
  path,
  readOnly,
  label,
  onChange,
  onSubmit,
}: {
  value: string
  dirty: boolean
  language: string
  // Model name; its extension matters (.tsx enables JSX in the TypeScript mode).
  path: string
  readOnly?: boolean
  label: string
  onChange?: (value: string) => void
  // Ctrl/Cmd+Enter, with the editor's current text (state can lag a keystroke behind).
  onSubmit?: (value: string) => void
}) {
  const { resolvedTheme } = useTheme()
  const prefs = useEditorPrefs()
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const syncing = useRef(false)
  const submit = useRef(onSubmit)
  useEffect(() => {
    submit.current = onSubmit
  })
  useEffect(() => {
    const ed = editor.current
    if (!ed || dirty || ed.getValue() === value) return
    syncing.current = true
    ed.setValue(value)
    syncing.current = false
  }, [value, dirty])
  return (
    <Editor
      defaultValue={value}
      language={language}
      path={path}
      theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
      onChange={(v) => !syncing.current && onChange?.(v ?? "")}
      onMount={(ed, m) => {
        editor.current = ed
        ed.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Enter, () =>
          submit.current?.(ed.getValue())
        )
      }}
      loading={
        <p className="p-4 text-xs text-muted-foreground">Loading editor…</p>
      }
      options={{
        readOnly,
        ariaLabel: label,
        fontSize: prefs.fontSize,
        tabSize: 2,
        wordWrap: prefs.wordWrap ? "on" : "off",
        minimap: { enabled: prefs.minimap },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        formatOnPaste: true,
        bracketPairColorization: { enabled: true },
        renderLineHighlight: readOnly ? "none" : "line",
        padding: { top: 12 },
      }}
    />
  )
}
