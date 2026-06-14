import logo from '@renderer/assets/logo.png'
import { CommitView } from '@renderer/components/git/commit-view'
import { DiffView } from '@renderer/components/git/diff-view'
import { FeatureView } from '@renderer/components/git/feature-view'
import { Kbd } from '@renderer/components/ui/kbd'
import { FileContent } from '@renderer/components/viewer/file-content'
import { SearchView } from '@renderer/components/viewer/search-view'
import { useTabsStore } from '@renderer/stores/tabs'

export function Viewer(): React.JSX.Element {
  const activeTab = useTabsStore((s) => s.tabs.find((t) => t.id === s.activeTabId))

  if (!activeTab) {
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

  // The annotated return type makes a missing kind a compile error — every tab
  // kind the store can hold must be dispatched here.
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
