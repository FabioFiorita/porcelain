import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@renderer/components/ui/empty'
import { cn } from '@renderer/lib/utils'
import { HubRepoProvider } from '@renderer/stores/hub-repo'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { type Tab, useTabsStore } from '@renderer/stores/tabs'
import { TestIds } from '@shared/test-ids'
import { PanelRight } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { SplitResizeHandle } from './sidebar-resize-handle'
import { TabBar } from './tab-bar'

// Opening the shell should not parse every rich viewer (and its Markdown, syntax
// highlighting, or canvas dependencies). Each surface stays a distinct boundary
// so the active tab is the only one requested. Named exports keep the component
// modules' public APIs unchanged.
const DiffView = lazy(() =>
  import('@renderer/components/git/diff-view').then((module) => ({ default: module.DiffView })),
)
const CommitView = lazy(() =>
  import('@renderer/components/git/commit-view').then((module) => ({ default: module.CommitView })),
)
const ChangesetView = lazy(() =>
  import('@renderer/components/git/changeset-view').then((module) => ({
    default: module.ChangesetView,
  })),
)
const SearchView = lazy(() =>
  import('@renderer/components/viewer/search-view').then((module) => ({
    default: module.SearchView,
  })),
)
const FileContent = lazy(() =>
  import('@renderer/components/viewer/file-content').then((module) => ({
    default: module.FileContent,
  })),
)
const CanvasView = lazy(() =>
  import('@renderer/features/projects/canvas-view').then((module) => ({
    default: module.CanvasView,
  })),
)

function ViewerSurfaceBoundary({ children }: { children: React.ReactNode }): React.JSX.Element {
  // Retain the pane's dimensions while a just-selected surface module loads. A
  // blank fallback avoids flashing an unrelated loading screen between tabs.
  return <Suspense fallback={<div className="h-full" aria-busy="true" />}>{children}</Suspense>
}

function EmptyViewer(): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <Empty data-testid={TestIds.viewerEmpty} className="w-full max-w-sm">
        <EmptyMedia>
          <PanelRight />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>Open a surface to get started</EmptyTitle>
          <EmptyDescription>Choose one from the Surfaces rail.</EmptyDescription>
        </EmptyHeader>
      </Empty>
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

  const content = (
    <ViewerSurfaceBoundary>
      <PaneContent tab={activeTab} paneIndex={paneIndex} />
    </ViewerSurfaceBoundary>
  )
  if (activeTab.target === undefined) return content
  return <HubRepoProvider target={activeTab.target}>{content}</HubRepoProvider>
}

function PaneContent({ tab, paneIndex }: { tab: Tab; paneIndex: number }): React.JSX.Element {
  switch (tab.kind) {
    case 'diff':
      // `base` isn't part of tab identity (`tab.id`), so a re-open with a new base
      // updates the same tab entry — remount on that change too, or the old diff lingers.
      return (
        <DiffView
          key={`${tab.id}:${tab.base ?? ''}`}
          filePath={tab.path}
          base={tab.base}
          paneIndex={paneIndex}
        />
      )
    case 'commit':
      return (
        <CommitView
          key={`${tab.id}:${tab.reviewFilePath ?? ''}`}
          hash={tab.path}
          filePath={tab.reviewFilePath}
          paneIndex={paneIndex}
        />
      )
    case 'changeset':
      return <ChangesetView key={tab.id} path={tab.path} paneIndex={paneIndex} />
    case 'search':
      return <SearchView key={tab.id} query={tab.path} />
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
    case 'canvas':
      // A canvas tab is only ever opened with an explicit target (CanvasList);
      // an untargeted one has nothing to resolve a Project id from.
      if (tab.target === undefined) {
        return <p className="p-4 text-sm text-muted-foreground">This Canvas tab has no target.</p>
      }
      return (
        <CanvasView
          key={tab.id}
          projectId={tab.target.projectId}
          canvasId={tab.path}
          worktreePath={tab.target.path}
          environmentId={tab.target.environmentId}
          reviewTarget={tab.reviewTarget}
        />
      )
  }
}

// One column of a split viewer: its own tab bar + content. Clicking anywhere in
// the pane focuses it so new opens land here. The unsplit tab bar lives in the
// ViewerHeader so it shares the header row with the active file context/actions.
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
      <div className={cn('flex h-9 shrink-0 items-center px-1.5', isActive && 'bg-muted/20')}>
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

  // Unsplit: the header owns both shell actions and the tab strip. Split panes
  // retain their local tab bars so the existing split-view mechanics stay intact.
  if (paneCount === 1) {
    return (
      <div className="h-full min-h-0">
        <PaneView paneIndex={0} />
      </div>
    )
  }

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
