import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { cn } from '@renderer/lib/utils'
import {
  type DiffMode,
  type MarkdownMode,
  type PullMode,
  type TerminalRenderer,
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
      <div>
        <p className="text-sm-minus font-semibold">{label}</p>
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
  const pullMode = usePreferencesStore((s) => s.pullMode)
  const setPullMode = usePreferencesStore((s) => s.setPullMode)
  const terminalRenderer = usePreferencesStore((s) => s.terminalRenderer)
  const setTerminalRenderer = usePreferencesStore((s) => s.setTerminalRenderer)

  return (
    <div className="flex flex-col gap-5">
      <PreferenceRow label="Diff layout" description="How file diffs are rendered.">
        <ToggleGroup
          value={[diffMode]}
          onValueChange={(value: string[]) => {
            const mode = value[0]
            if (mode === 'unified' || mode === 'split') setDiffMode(mode satisfies DiffMode)
          }}
        >
          <ToggleGroupItem value="unified" size="sm">
            Unified
          </ToggleGroupItem>
          <ToggleGroupItem value="split" size="sm">
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
          <ToggleGroupItem value="reader" size="sm">
            Reader
          </ToggleGroupItem>
          <ToggleGroupItem value="source" size="sm">
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
          <ToggleGroupItem value="merge" size="sm">
            Merge
          </ToggleGroupItem>
          <ToggleGroupItem value="rebase" size="sm">
            Rebase
          </ToggleGroupItem>
        </ToggleGroup>
      </PreferenceRow>
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-sm-minus font-semibold">Terminal display</p>
          <p className="text-xs text-muted-foreground">
            How the embedded terminal paints cells. Applies immediately to open sessions (history
            colors reset on switch; the shell keeps running). Canvas is no longer available —
            xterm.js removed it in v6. On iPad, WebGL always falls back to DOM.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {TERMINAL_RENDERERS.map((option) => {
            const selected = terminalRenderer === option.value
            const inputId = `terminal-renderer-${option.value}`
            return (
              <label
                key={option.value}
                htmlFor={inputId}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors',
                  selected
                    ? 'border-white/20 bg-(--selected-fill)'
                    : 'border-border/60 bg-transparent hover:bg-(--hover-fill)',
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
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm-minus font-semibold">{option.label}</span>
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
