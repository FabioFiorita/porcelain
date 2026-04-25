import { DiffView } from '@renderer/components/git/diff-view'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { CodeLine, useHighlighter } from '@renderer/components/viewer/code-line'
import { languageFor } from '@renderer/lib/highlight'
import { trpc } from '@renderer/lib/trpc'
import { useTabsStore } from '@renderer/stores/tabs'

function FileContent({ path }: { path: string }): React.JSX.Element {
  const { data: content, error } = trpc.readFile.useQuery(path)
  const highlighter = useHighlighter()
  const lang = languageFor(path)

  if (error) {
    return <p className="p-4 text-sm text-destructive">{error.message}</p>
  }
  if (content === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }

  const lines = content.split('\n')

  return (
    <ScrollArea className="h-full">
      <div className="p-4 font-mono text-xs leading-5">
        {lines.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional
          <div key={i} className="flex">
            <span className="w-10 shrink-0 select-none pr-3 text-right text-muted-foreground/50">
              {i + 1}
            </span>
            <CodeLine text={line} lang={lang} highlighter={highlighter} />
          </div>
        ))}
      </div>
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
