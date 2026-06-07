import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { isMarkdownPath, MarkdownView } from '@renderer/components/viewer/markdown-view'
import { relativeTo } from '@renderer/lib/paths'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useEffect, useState } from 'react'
import { EDITABLE_MAX_LINES, EditorSource } from './editor-source'
import { FindBar } from './find-bar'
import { SourceContextMenu } from './source-context-menu'
import { SourceView } from './source-view'

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

export function TextFileView({
  path,
  content,
  line,
}: {
  path: string
  content: string
  line?: number
}): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const markdownMode = usePreferencesStore((s) => s.markdownMode)
  const [finding, setFinding] = useState(false)
  const [findLine, setFindLine] = useState<number | undefined>(undefined)
  const markdown = isMarkdownPath(path)
  const reader = markdown && markdownMode === 'reader'
  const editable = !reader && content.split('\n').length <= EDITABLE_MAX_LINES
  const highlightLine = finding && findLine !== undefined ? findLine : line

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'f' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        setFinding(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 items-center justify-between gap-2 border-b px-3">
        <span className="truncate font-mono text-xs text-muted-foreground">
          {relativeTo(repo?.path, path)}
        </span>
        {markdown && <MarkdownModeToggle />}
      </div>
      {finding && !reader && (
        <FindBar content={content} onClose={() => setFinding(false)} onMatchLine={setFindLine} />
      )}
      <div className="min-h-0 flex-1">
        {reader ? (
          <SourceContextMenu path={path}>
            <MarkdownView content={content} />
          </SourceContextMenu>
        ) : editable ? (
          <EditorSource path={path} initialContent={content} highlightLine={highlightLine} />
        ) : (
          <SourceContextMenu path={path}>
            <SourceView path={path} content={content} highlightLine={highlightLine} />
          </SourceContextMenu>
        )}
      </div>
    </div>
  )
}
