import { DiffView } from '@renderer/components/git/diff-view'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { trpc } from '@renderer/lib/trpc'
import { useTabsStore } from '@renderer/stores/tabs'
import { useEffect, useState } from 'react'

function FileContent({ path }: { path: string }): React.JSX.Element {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setContent(null)
    setError(null)
    trpc.readFile
      .query(path)
      .then(setContent)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [path])

  if (error) {
    return <p className="p-4 text-sm text-destructive">{error}</p>
  }
  if (content === null) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <ScrollArea className="h-full">
      <pre className="p-4 font-mono text-xs leading-5 text-foreground">{content}</pre>
    </ScrollArea>
  )
}

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

  if (activeTab.kind === 'diff') {
    return <DiffView filePath={activeTab.path} />
  }

  return <FileContent path={activeTab.path} />
}
