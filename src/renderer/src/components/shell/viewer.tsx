import { CommitView } from '@renderer/components/git/commit-view'
import { DiffView } from '@renderer/components/git/diff-view'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { CodeLine, useHighlighter } from '@renderer/components/viewer/code-line'
import { isMarkdownPath, MarkdownView } from '@renderer/components/viewer/markdown-view'
import { VirtualRows } from '@renderer/components/viewer/virtual-rows'
import { languageFor } from '@renderer/lib/highlight'
import { trpc } from '@renderer/lib/trpc'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useTabsStore } from '@renderer/stores/tabs'

function SourceView({ path, content }: { path: string; content: string }): React.JSX.Element {
  const highlighter = useHighlighter()
  const lang = languageFor(path)
  const lines = content.split('\n')

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

function MarkdownModeToggle(): React.JSX.Element {
  const markdownMode = usePreferencesStore((s) => s.markdownMode)
  const setMarkdownMode = usePreferencesStore((s) => s.setMarkdownMode)

  return (
    <ToggleGroup
      value={[markdownMode]}
      onValueChange={(value: string[]) => {
        const mode = value[0]
        if (mode === 'reader' || mode === 'source') setMarkdownMode(mode)
      }}
    >
      <ToggleGroupItem value="reader" size="sm">
        Reader
      </ToggleGroupItem>
      <ToggleGroupItem value="source" size="sm">
        Source
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

function MarkdownContent({ path, content }: { path: string; content: string }): React.JSX.Element {
  const markdownMode = usePreferencesStore((s) => s.markdownMode)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end border-b px-3 py-1">
        <MarkdownModeToggle />
      </div>
      <div className="min-h-0 flex-1">
        {markdownMode === 'reader' ? (
          <MarkdownView content={content} />
        ) : (
          <SourceView path={path} content={content} />
        )}
      </div>
    </div>
  )
}

function FileContent({ path }: { path: string }): React.JSX.Element {
  const { data: view, error } = trpc.readFile.useQuery(path)

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

  if (isMarkdownPath(path)) {
    return <MarkdownContent path={path} content={view.content} />
  }

  return <SourceView path={path} content={view.content} />
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
