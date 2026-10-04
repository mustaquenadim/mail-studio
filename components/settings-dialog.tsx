"use client"

import { useEffect, useState } from "react"
import { Settings } from "lucide-react"
import { useTheme } from "next-themes"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tip } from "@/components/tip"
import {
  EDITOR_THEMES,
  FONT_SIZES,
  setEditorPrefs,
  useEditorPrefs,
} from "@/lib/editor-prefs"

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
]

// Clears the draft, recipients and editor prefs. The theme has its own control, so it stays.
function resetLocalData() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("email-builder:"))
      .forEach((k) => localStorage.removeItem(k))
  } catch {}
  // The draft also lives in EmailBuilder state; reload so the next edit doesn't save it back.
  location.reload()
}

// OpenRouter model ids that support structured outputs (the generator needs them). Public, CORS-enabled.
function useModels(open: boolean) {
  const [models, setModels] = useState<string[]>([])
  useEffect(() => {
    if (!open || models.length) return
    fetch("https://openrouter.ai/api/v1/models")
      .then((r) => r.json())
      .then((d: { data: { id: string; supported_parameters?: string[] }[] }) =>
        setModels(
          d.data
            .filter((m) =>
              m.supported_parameters?.includes("structured_outputs")
            )
            .map((m) => m.id)
            .sort()
        )
      )
      .catch(() => {}) // Offline: the dropdown still shows the saved model.
  }, [open, models.length])
  return models
}

export function SettingsDialog() {
  const { theme, setTheme } = useTheme()
  const prefs = useEditorPrefs()
  const [open, setOpen] = useState(false)
  const models = useModels(open)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tip label="Settings" side="bottom">
        <DialogTrigger
          render={
            <Button size="icon-sm" variant="ghost" aria-label="Settings" />
          }
        >
          <Settings />
        </DialogTrigger>
      </Tip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Preferences are saved in this browser.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="settings-theme">Theme</Label>
          <Select
            items={THEMES}
            value={theme}
            onValueChange={(v) => v && setTheme(v)}
          >
            <SelectTrigger id="settings-theme" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEMES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-3">
          <p className="text-sm font-medium">Code editor</p>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="settings-font-size">Font size</Label>
            <Select
              items={FONT_SIZES}
              value={String(prefs.fontSize)}
              onValueChange={(v) =>
                v && setEditorPrefs({ fontSize: Number(v) })
              }
            >
              <SelectTrigger id="settings-font-size" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_SIZES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="settings-editor-theme">Theme</Label>
            <Select
              items={EDITOR_THEMES}
              value={prefs.editorTheme}
              onValueChange={(v) => v && setEditorPrefs({ editorTheme: v })}
            >
              <SelectTrigger id="settings-editor-theme" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITOR_THEMES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="settings-wrap">Word wrap</Label>
            <Switch
              id="settings-wrap"
              checked={prefs.wordWrap}
              onCheckedChange={(wordWrap) => setEditorPrefs({ wordWrap })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="settings-minimap">Minimap</Label>
            <Switch
              id="settings-minimap"
              checked={prefs.minimap}
              onCheckedChange={(minimap) => setEditorPrefs({ minimap })}
            />
          </div>
        </div>
        <div className="grid gap-3 border-t pt-4">
          <div className="grid gap-1">
            <p className="text-sm font-medium">AI (OpenRouter)</p>
            <p className="text-xs text-muted-foreground">
              Used by Generate with AI. The key stays in this browser and is
              sent only with generate requests.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settings-ai-key">API key</Label>
            <Input
              id="settings-ai-key"
              type="password"
              autoComplete="off"
              placeholder="sk-or-…"
              value={prefs.aiKey}
              onChange={(e) => setEditorPrefs({ aiKey: e.target.value.trim() })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settings-ai-model">Model</Label>
            <Combobox
              // Keep the saved model selectable while the list loads or if the fetch fails.
              items={
                models.includes(prefs.aiModel)
                  ? models
                  : [prefs.aiModel, ...models]
              }
              value={prefs.aiModel}
              onValueChange={(v) => v && setEditorPrefs({ aiModel: v })}
            >
              <ComboboxInput
                id="settings-ai-model"
                className="w-full"
                placeholder="Search models…"
              />
              <ComboboxContent>
                <ComboboxEmpty>No models found.</ComboboxEmpty>
                <ComboboxList>
                  {(m: string) => (
                    <ComboboxItem key={m} value={m}>
                      {m}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <div className="grid gap-1">
            <p className="text-sm font-medium">Reset local data</p>
            <p className="text-xs text-muted-foreground">
              Clears the saved draft, recent recipients, editor settings and AI
              key.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button size="sm" variant="destructive" />}
            >
              Reset
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset local data?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your current email will be deleted. You can&apos;t undo this.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={resetLocalData}
                >
                  Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  )
}
