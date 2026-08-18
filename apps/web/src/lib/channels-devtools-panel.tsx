import { useActions } from '@renderer/features/actions'
import { usePluginInfo } from '@renderer/hooks/use-plugin'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'

/**
 * A product-specific devtools panel that inspects Porcelain's agent channels — the
 * two surfaced here (review set, actions) plus the shipped
 * plugin version. Each channel is a `~/.porcelain/*.json` file the porcelain CLI
 * (`src/cli/`) reads/writes; the renderer sees them through the same domain hooks
 * the UI uses, so this panel is a live mirror of what the agent can currently
 * see/do. Registered as a `plugins` entry in {@link DevtoolsShell}.
 */
export function ChannelsDevtoolsPanel(): React.JSX.Element {
  const project = useProjectSelectionStore((s) => s.project)
  const plugin = usePluginInfo()
  const actions = useActions()

  if (!project) {
    return <div style={WRAP}>No project open — the agent channels are project-keyed.</div>
  }

  return (
    <div style={WRAP}>
      <Section title="Agent plugin">
        <Row label="Version" value={plugin?.version ?? '—'} />
        <Row label="Install" value={plugin?.installCommand ?? '—'} />
      </Section>

      <Section title="Actions (two-way)">
        <Row label="Saved" value={String(actions.length)} />
      </Section>
    </div>
  )
}

const WRAP: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 12,
  fontSize: 12,
  lineHeight: 1.5,
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', fontSize: 10 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ minWidth: 80, opacity: 0.6 }}>{label}</span>
      <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}
