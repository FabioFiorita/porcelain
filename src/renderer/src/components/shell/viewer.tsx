import logo from '@renderer/assets/logo.png'
import { BoardView } from '@renderer/components/board/board-view'
import { CommitView } from '@renderer/components/git/commit-view'
import { DiffView } from '@renderer/components/git/diff-view'
import { ExploreView } from '@renderer/components/git/explore-view'
import { FeatureView } from '@renderer/components/git/feature-view'
import { TerminalView } from '@renderer/components/terminal/terminal-view'
import { Kbd } from '@renderer/components/ui/kbd'
import { FileContent } from '@renderer/components/viewer/file-content'
import { SearchView } from '@renderer/components/viewer/search-view'
import { kbdLabel } from '@renderer/lib/keyboard'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useTabsStore } from '@renderer/stores/tabs'
import { SplitResizeHandle } from './sidebar-resize-handle'
import { TabBar } from './tab-bar'

// The empty viewer is the most-seen blank surface, so it doubles as a quiet
// quick-start: the three gestures that get you moving, each with its shortcut.
const QUICKSTART: { label: string; keys: string }[] = [
  { label: 'Search files', keys: kbdLabel('mod', 'P') },
  { label: 'Browse the tree', keys: kbdLabel('mod', '1') },
  { label: 'Review changes', keys: kbdLabel('mod', '2') },
]

function EmptyViewer(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-7 px-6 text-center">
      <div className="flex flex-col items-center gap-3">
        {/* The mark sits on the void like a fired tile — a soft drop shadow
            follows its squircle so it reads as a physical object, not an icon. */}
        <img
          src={logo}
          alt=""
          draggable={false}
          className="size-16 [filter:drop-shadow(0_10px_22px_rgb(0_0_0/0.45))]"
        />
        <div className="space-y-0.5">
          <p className="text-xl font-medium tracking-tight text-foreground">porcelain</p>
          <p className="text-sm text-muted-foreground">Review changes as a story</p>
        </div>
      </div>
      <div className="flex w-56 flex-col">
        {QUICKSTART.map((item, i) => (
          <div
            key={item.keys}
            className={cn(
              'flex items-center justify-between py-1.5 text-xs text-muted-foreground',
              i > 0 && 'border-t border-border/60',
            )}
          >
            <span>{item.label}</span>
            <Kbd>{item.keys}</Kbd>
          </div>
        ))}
      </div>
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
      return (
        <DiffView
          key={`${activeTab.path}:${activeTab.base ?? ''}`}
          filePath={activeTab.path}
          base={activeTab.base}
        />
      )
    case 'commit':
      return <CommitView key={activeTab.path} hash={activeTab.path} />
    case 'search':
      return <SearchView key={activeTab.path} query={activeTab.path} />
    case 'feature':
      return <FeatureView />
    case 'board':
      return <BoardView />
    case 'terminal':
      return <TerminalView key={activeTab.path} sessionId={activeTab.path} />
    case 'explore':
      return (
        <ExploreView
          key={`${activeTab.path}:${activeTab.symbol ?? ''}`}
          path={activeTab.path}
          symbol={activeTab.symbol}
        />
      )
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
