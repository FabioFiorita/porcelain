import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { compactButtonClass } from '@renderer/lib/controls'
import { cn } from '@renderer/lib/utils'
import {
  type DiffMode,
  type HtmlMode,
  type MarkdownMode,
  type PullMode,
  type TerminalRenderer,
  type ThemeMode,
  usePreferencesStore,
} from '@renderer/stores/preferences'

const TERMINAL_RENDERERS: {
  value: TerminalRenderer
  label: string
  badge?: string
  description: string
}[] = [
  {
    value: 'webgl',
    label: 'WebGL',
    badge: 'Default',
    description:
      'GPU-accelerated. Crisp Claude Code logo and powerline block glyphs. Can occasionally garble text (texture-atlas corruption) — switch tabs, hide the window, or pick DOM to recover.',
  },
  {
    value: 'dom',
    label: 'DOM',
    badge: 'Most stable',
    description:
      'Renders with ordinary HTML. Never garbles. Slightly slower on heavy output; block-drawing art shows thin gaps between cells. Prefer this if WebGL has been glitching.',
  },
]

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

/** Viewer + git prefs only. Share / remote daemons live under Environments. */
export function GeneralSection(): React.JSX.Element {
  const diffMode = usePreferencesStore((s) => s.diffMode)
  const setDiffMode = usePreferencesStore((s) => s.setDiffMode)
  const markdownMode = usePreferencesStore((s) => s.markdownMode)
  const setMarkdownMode = usePreferencesStore((s) => s.setMarkdownMode)
  const htmlMode = usePreferencesStore((s) => s.htmlMode) ?? 'preview'
  const setHtmlMode = usePreferencesStore((s) => s.setHtmlMode)
  const pullMode = usePreferencesStore((s) => s.pullMode)
  const setPullMode = usePreferencesStore((s) => s.setPullMode)
  const terminalRenderer = usePreferencesStore((s) => s.terminalRenderer)
  const setTerminalRenderer = usePreferencesStore((s) => s.setTerminalRenderer)
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
          <ToggleGroupItem value="system" size="sm" className={compactButtonClass}>
            System
          </ToggleGroupItem>
          <ToggleGroupItem value="light" size="sm" className={compactButtonClass}>
            Light
          </ToggleGroupItem>
          <ToggleGroupItem value="dark" size="sm" className={compactButtonClass}>
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
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-sm-minus font-medium">Terminal display</p>
          <p className="text-xs text-muted-foreground">
            How the embedded terminal paints cells. Applies immediately to open sessions (history
            colors reset on switch; the shell keeps running). Canvas is no longer available —
            xterm.js removed it in v6. On iPad, WebGL always falls back to DOM.
          </p>
        </div>
        <div className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
          {TERMINAL_RENDERERS.map((option) => {
            const selected = terminalRenderer === option.value
            const inputId = `terminal-renderer-${option.value}`
            return (
              <label
                key={option.value}
                htmlFor={inputId}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 px-3 py-2.5 text-left transition-colors',
                  selected ? 'bg-accent' : 'hover:bg-accent',
                )}
              >
                <input
                  id={inputId}
                  type="radio"
                  name="terminal-renderer"
                  value={option.value}
                  checked={selected}
                  onChange={() => setTerminalRenderer(option.value)}
                  className="mt-0.5 size-3.5 shrink-0 accent-foreground"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-medium">{option.label}</span>
                    {option.badge != null && (
                      <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                        {option.badge}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                </span>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
