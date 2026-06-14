import logo from '@renderer/assets/logo.png'
import { CommitView } from '@renderer/components/git/commit-view'
import { DiffView } from '@renderer/components/git/diff-view'
import { FeatureView } from '@renderer/components/git/feature-view'
import { Kbd } from '@renderer/components/ui/kbd'
import { FileContent } from '@renderer/components/viewer/file-content'
import { SearchView } from '@renderer/components/viewer/search-view'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useTabsStore } from '@renderer/stores/tabs'
import { SplitResizeHandle } from './sidebar-resize-handle'
import { TabBar } from './tab-bar'

function EmptyViewer(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
      <img src={logo} alt="" className="size-16 opacity-80" draggable={false} />
      <p className="mt-2 text-lg font-medium">porcelain</p>
      <p className="text-sm">Review changes as a story</p>
      <p className="mt-3 flex items-center gap-1.5 text-xs">
        Open a file from the sidebar, or press <Kbd>⌘P</Kbd> to search
      </p>
    </div>
  )
}

// Renders the active tab of one pane. The annotated return type makes a missing
// kind a compile error — every tab kind the store can hold must be dispatched.
function PaneView({ paneIndex }: { paneIndex: number }): React.JSX.Element {
  const activeTab = useTabsStore((s) => {
    const pane = s.panes[paneIndex]
    return pane?.tabs.find((t) => t.id === pane.activeTabId)
  })

  if (!activeTab) return <EmptyViewer />

  switch (activeTab.kind) {
    case 'diff':
      return <DiffView filePath={activeTab.path} />
    case 'commit':
      return <CommitView hash={activeTab.path} />
    case 'search':
      return <SearchView query={activeTab.path} />
    case 'feature':
      return <FeatureView />
    case 'file':
      // keyed by path so edit state never leaks across tab switches
      return <FileContent key={activeTab.path} path={activeTab.path} line={activeTab.line} />
  }
}

// One column of a split viewer: its own tab bar + content. Clicking anywhere in
// the pane focuses it so new opens land here.
function SplitPane({ paneIndex }: { paneIndex: number }): React.JSX.Element {
  const isActive = useTabsStore((s) => s.activePaneIndex === paneIndex)
  const setActivePane = useTabsStore((s) => s.setActivePane)

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pane focus follows the click that targets a child
    <div
      className={cn(
        'flex min-w-0 flex-col',
        // left pane takes the persisted share; right pane fills the rest
        paneIndex === 0 ? 'shrink-0 grow-0 basis-[var(--split-left)]' : 'flex-1',
      )}
      onMouseDown={() => setActivePane(paneIndex)}
    >
      <div
        className={cn(
          'flex h-9 shrink-0 items-center border-b px-1.5',
          isActive ? 'border-b-primary/40' : 'border-b-border',
        )}
      >
        <TabBar paneIndex={paneIndex} />
      </div>
      <div className="min-h-0 flex-1">
        <PaneView paneIndex={paneIndex} />
      </div>
    </div>
  )
}

export function Viewer(): React.JSX.Element {
  const paneCount = useTabsStore((s) => s.panes.length)
  const splitRatio = usePreferencesStore((s) => s.splitRatio)

  // Unsplit: the tab bar lives in the chrome top bar, so the viewer is just the
  // single pane's content (no inline tab bar).
  if (paneCount === 1) return <PaneView paneIndex={0} />

  return (
    <div
      data-slot="viewer-split"
      className="flex h-full"
      style={{ '--split-left': `${splitRatio * 100}%` } as React.CSSProperties}
    >
      <SplitPane paneIndex={0} />
      <SplitResizeHandle />
      <SplitPane paneIndex={1} />
    </div>
  )
}
