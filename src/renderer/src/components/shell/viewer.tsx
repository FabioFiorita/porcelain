import { useTabsStore } from '@renderer/stores/tabs'

export function Viewer(): React.JSX.Element {
  const activeTab = useTabsStore((s) => s.tabs.find((t) => t.id === s.activeTabId))

  if (!activeTab) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
        <p className="text-lg font-medium">porcelain</p>
        <p className="text-sm">Open a file from the sidebar to view it</p>
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <p className="text-sm">
        {activeTab.kind}: {activeTab.path}
      </p>
    </div>
  )
}
