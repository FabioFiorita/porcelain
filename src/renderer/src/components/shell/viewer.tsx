import logo from '@renderer/assets/logo.png'
import { AgentView } from '@renderer/components/agent/agent-view'
import { BoardView } from '@renderer/components/board/board-view'
import { ChatView } from '@renderer/components/chat/chat-view'
import { CommitView } from '@renderer/components/git/commit-view'
import { DiffView } from '@renderer/components/git/diff-view'
import { ExploreView } from '@renderer/components/git/explore-view'
import { FeatureView } from '@renderer/components/git/feature-view'
import { ReviewView } from '@renderer/components/git/review-view'
import { TerminalView } from '@renderer/components/terminal/terminal-view'
import { Kbd } from '@renderer/components/ui/kbd'
import { FileContent } from '@renderer/components/viewer/file-content'
import { SearchView } from '@renderer/components/viewer/search-view'
import { kbdLabel } from '@renderer/lib/keyboard'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useTabsStore } from '@renderer/stores/tabs'
import { GlanceHome } from './glance-home'
import { SplitResizeHandle } from './sidebar-resize-handle'
import { TabBar } from './tab-bar'

// Keyboard quick-start under the Glance (desktop). Chords match the rail order:
// Files ⌘1 · Agent ⌘2 · Changes ⌘3 · Review ⌘4 (U1).
const QUICKSTART: { label: string; keys: string }[] = [
  { label: 'Agent', keys: kbdLabel('mod', '2') },
  { label: 'Changes', keys: kbdLabel('mod', '3') },
  { label: 'Review', keys: kbdLabel('mod', '4') },
  { label: 'Search files', keys: kbdLabel('mod', 'P') },
]

function EmptyViewer(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)

  // With a repo open, empty pane is the Glance (work in flight) on every form
  // factor — phone already had it; desktop used to show only logo + chords (U6).
  if (repo !== null) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          <GlanceHome />
        </div>
        <div className="hidden shrink-0 border-t border-border/60 px-4 py-3 [@media(hover:hover)]:block">
          <div className="mx-auto flex max-w-md flex-col">
            {QUICKSTART.map((item, i) => (
              <div
                key={item.keys}
                className={cn(
                  'flex items-center justify-between py-1 text-xs text-muted-foreground',
                  i > 0 && 'border-t border-border/40',
                )}
              >
                <span>{item.label}</span>
                <Kbd>{item.keys}</Kbd>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-7 px-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <img
          src={logo}
          alt=""
          draggable={false}
          className="size-16 [filter:drop-shadow(0_10px_22px_rgb(0_0_0/0.45))]"
        />
        <div className="space-y-0.5">
          <p className="text-xl font-medium tracking-tight text-foreground">porcelain</p>
          <p className="text-sm text-muted-foreground">Run agents. Review as a story.</p>
          <p className="mt-2 max-w-xs text-xs text-muted-foreground/80 [@media(hover:hover)]:hidden">
            Open a repository to get started.
          </p>
        </div>
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
    case 'review':
      return <ReviewView key={activeTab.path} path={activeTab.path} />
    case 'search':
      return <SearchView key={activeTab.path} query={activeTab.path} />
    case 'feature':
      return <FeatureView />
    case 'board':
      return <BoardView />
    case 'chat':
      return <ChatView />
    case 'terminal':
      return <TerminalView key={activeTab.path} sessionId={activeTab.path} />
    case 'agent':
      return <AgentView key={activeTab.path} threadId={activeTab.path} />
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
      return (
        <FileContent
          key={activeTab.path}
          path={activeTab.path}
          line={activeTab.line}
          highlight={activeTab.highlight}
          paneIndex={paneIndex}
        />
      )
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
