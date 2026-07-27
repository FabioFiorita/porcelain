import { Switch } from '@renderer/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { compactButtonClass } from '@renderer/lib/controls'
import { isCoarseTouch } from '@renderer/lib/platform'
import {
  type DiffMode,
  type HtmlMode,
  type MarkdownMode,
  type PullMode,
  type ThemeMode,
  usePreferencesStore,
} from '@renderer/stores/preferences'
import { TestIds } from '@shared/test-ids'

/**
 * Settings type scale (page title lives on the dialog header):
 * - Control label: text-sm-minus font-medium
 * - Nested option: text-xs font-medium
 * - Description: text-xs text-muted-foreground
 */
function PreferenceRow({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm-minus font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

/** Viewer + git prefs only. Share / Remotes are their own Settings tabs. */
export function GeneralSection(): React.JSX.Element {
  const diffMode = usePreferencesStore((s) => s.diffMode)
  const setDiffMode = usePreferencesStore((s) => s.setDiffMode)
  const markdownMode = usePreferencesStore((s) => s.markdownMode)
  const setMarkdownMode = usePreferencesStore((s) => s.setMarkdownMode)
  const htmlMode = usePreferencesStore((s) => s.htmlMode) ?? 'preview'
  const setHtmlMode = usePreferencesStore((s) => s.setHtmlMode)
  const pullMode = usePreferencesStore((s) => s.pullMode)
  const setPullMode = usePreferencesStore((s) => s.setPullMode)
  // ?? true: the preference postdates persisted stores that never wrote the key.
  const terminalKeyBar = usePreferencesStore((s) => s.terminalKeyBar) ?? true
  const setTerminalKeyBar = usePreferencesStore((s) => s.setTerminalKeyBar)
  const theme = usePreferencesStore((s) => s.theme) ?? 'system'
  const setTheme = usePreferencesStore((s) => s.setTheme)

  return (
    <div className="flex flex-col gap-5">
      <PreferenceRow label="Appearance" description="Light, dark, or match the system.">
        <ToggleGroup
          value={[theme]}
          onValueChange={(value: string[]) => {
            const mode = value[0]
            if (mode === 'system' || mode === 'light' || mode === 'dark')
              setTheme(mode satisfies ThemeMode)
          }}
        >
          <ToggleGroupItem
            value="system"
            size="sm"
            className={compactButtonClass}
            data-testid={TestIds.settingsAppearanceSystem}
          >
            System
          </ToggleGroupItem>
          <ToggleGroupItem
            value="light"
            size="sm"
            className={compactButtonClass}
            data-testid={TestIds.settingsAppearanceLight}
          >
            Light
          </ToggleGroupItem>
          <ToggleGroupItem
            value="dark"
            size="sm"
            className={compactButtonClass}
            data-testid={TestIds.settingsAppearanceDark}
          >
            Dark
          </ToggleGroupItem>
        </ToggleGroup>
      </PreferenceRow>
      <PreferenceRow label="Diff layout" description="How file diffs are rendered.">
        <ToggleGroup
          value={[diffMode]}
          onValueChange={(value: string[]) => {
            const mode = value[0]
            if (mode === 'unified' || mode === 'split') setDiffMode(mode satisfies DiffMode)
          }}
        >
          <ToggleGroupItem value="unified" size="sm" className={compactButtonClass}>
            Unified
          </ToggleGroupItem>
          <ToggleGroupItem value="split" size="sm" className={compactButtonClass}>
            Split
          </ToggleGroupItem>
        </ToggleGroup>
      </PreferenceRow>
      <PreferenceRow label="Markdown" description="Default view when opening markdown files.">
        <ToggleGroup
          value={[markdownMode]}
          onValueChange={(value: string[]) => {
            const mode = value[0]
            if (mode === 'reader' || mode === 'source') setMarkdownMode(mode satisfies MarkdownMode)
          }}
        >
          <ToggleGroupItem value="reader" size="sm" className={compactButtonClass}>
            Reader
          </ToggleGroupItem>
          <ToggleGroupItem value="source" size="sm" className={compactButtonClass}>
            Source
          </ToggleGroupItem>
        </ToggleGroup>
      </PreferenceRow>
      <PreferenceRow
        label="HTML"
        description="Default view when opening .html files (sandboxed preview)."
      >
        <ToggleGroup
          value={[htmlMode]}
          onValueChange={(value: string[]) => {
            const mode = value[0]
            if (mode === 'preview' || mode === 'source') setHtmlMode(mode satisfies HtmlMode)
          }}
        >
          <ToggleGroupItem value="preview" size="sm" className={compactButtonClass}>
            Preview
          </ToggleGroupItem>
          <ToggleGroupItem value="source" size="sm" className={compactButtonClass}>
            Source
          </ToggleGroupItem>
        </ToggleGroup>
      </PreferenceRow>
      <PreferenceRow label="Pull strategy" description="How the git pull quick command reconciles.">
        <ToggleGroup
          value={[pullMode]}
          onValueChange={(value: string[]) => {
            const mode = value[0]
            if (mode === 'merge' || mode === 'rebase') setPullMode(mode satisfies PullMode)
          }}
        >
          <ToggleGroupItem value="merge" size="sm" className={compactButtonClass}>
            Merge
          </ToggleGroupItem>
          <ToggleGroupItem value="rebase" size="sm" className={compactButtonClass}>
            Rebase
          </ToggleGroupItem>
        </ToggleGroup>
      </PreferenceRow>
      {/* Touch only, matching where the bar itself renders (terminal-view.tsx) — on a
          desktop pointer this switch would toggle something that never appears. */}
      {isCoarseTouch() && (
        <PreferenceRow
          label="Terminal key bar"
          description="A row of Esc, Tab, Ctrl, arrow, and keyboard keys under each terminal — the keys a software keyboard doesn't have."
        >
          <Switch
            checked={terminalKeyBar}
            onCheckedChange={setTerminalKeyBar}
            className="shrink-0"
            data-testid={TestIds.settingsTerminalKeyBar}
          />
        </PreferenceRow>
      )}
    </div>
  )
}
