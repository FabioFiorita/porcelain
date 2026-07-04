import { Switch } from '@renderer/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { useSetTailnetBind, useTailnetStatus } from '@renderer/hooks/use-tailnet'
import {
  type DiffMode,
  type MarkdownMode,
  type PullMode,
  usePreferencesStore,
} from '@renderer/stores/preferences'

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

export function GeneralSection(): React.JSX.Element {
  const diffMode = usePreferencesStore((s) => s.diffMode)
  const setDiffMode = usePreferencesStore((s) => s.setDiffMode)
  const markdownMode = usePreferencesStore((s) => s.markdownMode)
  const setMarkdownMode = usePreferencesStore((s) => s.setMarkdownMode)
  const pullMode = usePreferencesStore((s) => s.pullMode)
  const setPullMode = usePreferencesStore((s) => s.setPullMode)
  const tailnet = useTailnetStatus()
  const { setEnabled } = useSetTailnetBind()

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
        <PreferenceRow
          label="Share over Tailscale"
          description="Lets other devices on your tailnet reach this daemon — token-gated."
        >
          <Switch
            checked={tailnet?.enabled ?? false}
            onCheckedChange={(checked) => setEnabled(checked)}
          />
        </PreferenceRow>
        {tailnet?.url != null && (
          <p className="font-mono text-xs text-muted-foreground">{tailnet.url}</p>
        )}
        {tailnet?.enabled === true && tailnet.url == null && (
          <p className="text-xs text-muted-foreground">No Tailscale interface found</p>
        )}
      </div>
    </div>
  )
}
