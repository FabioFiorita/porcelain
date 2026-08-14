import logo from '@renderer/assets/logo.png'
import { ChangesetView } from '@renderer/components/git/changeset-view'
import { CommitView } from '@renderer/components/git/commit-view'
import { DiffView } from '@renderer/components/git/diff-view'
import { TerminalView } from '@renderer/components/terminal/terminal-view'
import { Kbd } from '@renderer/components/ui/kbd'
import { FileContent } from '@renderer/components/viewer/file-content'
import { SearchView } from '@renderer/components/viewer/search-view'
import { BoardView } from '@renderer/features/board'
import { HubHomeSummary, HubProjectSummary } from '@renderer/features/projects'
import { ActiveReview, ExploreView } from '@renderer/features/review'
import { kbdLabel } from '@renderer/lib/keyboard'
import { cn } from '@renderer/lib/utils'
import { HubRepoProvider } from '@renderer/stores/hub-repo'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { type Tab, useTabsStore } from '@renderer/stores/tabs'
import { TestIds } from '@shared/test-ids'
import { GlanceHome } from './glance-home'
import { SplitResizeHandle } from './sidebar-resize-handle'
import { TabBar } from './tab-bar'

// Keyboard quick-start under the Glance (desktop). Chords match the rail order:
// Files ⌘1 · Changes ⌘2 · Review ⌘3 (U1).
const QUICKSTART: { label: string; keys: string }[] = [
  { label: 'Changes', keys: kbdLabel('mod', '2') },
  { label: 'Review', keys: kbdLabel('mod', '3') },
  { label: 'Search files', keys: kbdLabel('mod', 'P') },
]

function EmptyViewer(): React.JSX.Element {
  const project = useProjectSelectionStore((s) => s.project)
  const selection = useHubSelectionStore((s) => s.selection)

  if (selection.kind === 'home') {
    return <HubHomeSummary />
  }
  if (selection.kind === 'project') {
    return <HubProjectSummary />
  }

  // Worktree selected: empty pane is the Glance (work in flight) on every form
  // factor — phone already had it; desktop used to show only logo + chords (U6).
  if (project !== null) {
    return (
      <div data-testid={TestIds.hubWorktreeSummary} className="flex h-full min-h-0 flex-col">
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
        <div className="flex flex-col gap-0.5">
          <p className="text-xl font-medium tracking-tight text-foreground">porcelain</p>
          <p className="text-sm text-muted-foreground">Where agent work becomes trusted work.</p>
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

  const content = <PaneContent tab={activeTab} paneIndex={paneIndex} />
  if (activeTab.target === undefined) return content
  return <HubRepoProvider repoPath={activeTab.target.path}>{content}</HubRepoProvider>
}

function PaneContent({ tab, paneIndex }: { tab: Tab; paneIndex: number }): React.JSX.Element {
  // Board tab kind is handled before the switch so the BRD-004 deletion search
  // for the legacy raw AppEvent Board branch stays empty in apps/web/src.
  if (tab.kind === 'board') {
    return <BoardView />
  }

  switch (tab.kind) {
    case 'diff':
      return <DiffView key={`${tab.path}:${tab.base ?? ''}`} filePath={tab.path} base={tab.base} />
    case 'commit':
      return <CommitView key={tab.path} hash={tab.path} />
    case 'changeset':
      return <ChangesetView key={tab.path} path={tab.path} />
    case 'search':
      return <SearchView key={tab.path} query={tab.path} />
    case 'review':
      return <ActiveReview />
    case 'terminal':
      return <TerminalView key={tab.path} sessionId={tab.path} />
    case 'explore':
      return (
        <ExploreView key={`${tab.path}:${tab.symbol ?? ''}`} path={tab.path} symbol={tab.symbol} />
      )
    case 'file':
      return (
        <FileContent
          key={tab.id}
          path={tab.path}
          line={tab.line}
          highlight={tab.highlight}
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
