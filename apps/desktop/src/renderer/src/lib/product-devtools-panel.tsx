import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useTabsStore } from '@renderer/stores/tabs'

/**
 * Example product-specific devtools panel. It reads Porcelain's own zustand
 * stores (repo / tabs / preferences) and renders a live snapshot — the kind of
 * inspector that doesn't belong in any library's devtools. Mounted as one entry
 * in the unified shell's `plugins` array (see {@link DevtoolsShell}); add more
 * product panels there the same way.
 */
export function ProductDevtoolsPanel(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const sidebarTab = usePreferencesStore((s) => s.sidebarTab)
  const panes = useTabsStore((s) => s.panes)
  const activePaneIndex = useTabsStore((s) => s.activePaneIndex)
  const activeTab = panes[activePaneIndex]?.tabs.find(
    (t) => t.id === panes[activePaneIndex]?.activeTabId,
  )

  return (
    <div style={{ display: 'grid', gap: 8, padding: 12, fontSize: 12, lineHeight: 1.5 }}>
      <Row label="Repo" value={repo ? `${repo.name} (${repo.path})` : '—'} />
      <Row label="Sidebar tab" value={sidebarTab} />
      <Row label="Panes" value={String(panes.length)} />
      <Row
        label="Active tab"
        value={activeTab ? `${activeTab.kind} · ${activeTab.path ?? '—'}` : '—'}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ minWidth: 96, opacity: 0.6 }}>{label}</span>
      <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}
