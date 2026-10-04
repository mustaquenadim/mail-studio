"use client"

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
import { setEditorPrefs, useEditorPrefs } from "@/lib/editor-prefs"

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
]

const FONT_SIZES = [11, 12, 13, 14, 15, 16].map((n) => ({
  value: String(n),
  label: `${n}px`,
}))

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

export function SettingsDialog() {
  const { theme, setTheme } = useTheme()
  const prefs = useEditorPrefs()

  return (
    <Dialog>
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
        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <div className="grid gap-1">
            <p className="text-sm font-medium">Reset local data</p>
            <p className="text-xs text-muted-foreground">
              Clears the saved draft, recent recipients and editor settings.
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
