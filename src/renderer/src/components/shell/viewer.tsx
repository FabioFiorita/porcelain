import { CommitView } from '@renderer/components/git/commit-view'
import { DiffView } from '@renderer/components/git/diff-view'
import { CodeLine, useHighlighter } from '@renderer/components/viewer/code-line'
import { VirtualRows } from '@renderer/components/viewer/virtual-rows'
import { languageFor } from '@renderer/lib/highlight'
import { trpc } from '@renderer/lib/trpc'
import { useTabsStore } from '@renderer/stores/tabs'

function FileContent({ path }: { path: string }): React.JSX.Element {
  const { data: view, error } = trpc.readFile.useQuery(path)
  const highlighter = useHighlighter()
  const lang = languageFor(path)

  if (error) {
    return <p className="p-4 text-sm text-destructive">{error.message}</p>
  }
  if (view === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }

  if (view.type === 'image') {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <img src={view.dataUrl} alt={path} className="max-h-full max-w-full object-contain" />
      </div>
    )
  }

  if (view.type === 'binary') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Binary file · {(view.size / 1024).toFixed(1)} KB
      </div>
    )
  }

  const lines = view.content.split('\n')

  return (
    <VirtualRows
      rows={lines}
      className="px-4 py-2 leading-5"
      renderRow={(line, i) => (
        <div className="flex">
          <span className="w-10 shrink-0 select-none pr-3 text-right text-muted-foreground/50">
            {i + 1}
          </span>
          <CodeLine text={line} lang={lang} highlighter={highlighter} />
        </div>
      )}
    />
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

  if (activeTab.kind === 'commit') {
    return <CommitView hash={activeTab.path} />
  }

  return <FileContent path={activeTab.path} />
}
