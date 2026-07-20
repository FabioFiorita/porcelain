import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { HtmlView, isHtmlPath } from '@renderer/components/viewer/html-view'
import { isMarkdownPath, MarkdownView } from '@renderer/components/viewer/markdown-view'
import { useCommentIndex } from '@renderer/hooks/use-comments'
import { usePreviewHtml } from '@renderer/hooks/use-files'
import { relativeTo } from '@renderer/lib/paths'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useTabsStore } from '@renderer/stores/tabs'
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

function HtmlModeToggle(): React.JSX.Element {
  const htmlMode = usePreferencesStore((s) => s.htmlMode) ?? 'preview'
  const setHtmlMode = usePreferencesStore((s) => s.setHtmlMode)

  return (
    <ToggleGroup
      value={[htmlMode]}
      onValueChange={(value: string[]) => {
        const mode = value[0]
        if (mode === 'preview' || mode === 'source') setHtmlMode(mode)
      }}
    >
      <ToggleGroupItem value="preview" size="sm">
        Preview
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
  highlightRanges,
  paneIndex,
}: {
  path: string
  content: string
  line?: number
  /** Agent-changed line ranges from the Feature outline (tinted in source). */
  highlightRanges?: { start: number; end: number }[]
  paneIndex: number
}): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const markdownMode = usePreferencesStore((s) => s.markdownMode)
  const htmlMode = usePreferencesStore((s) => s.htmlMode) ?? 'preview'
  const [finding, setFinding] = useState(false)
  const [findLine, setFindLine] = useState<number | undefined>(undefined)
  const markdown = isMarkdownPath(path)
  const html = isHtmlPath(path)
  const reader = markdown && markdownMode === 'reader'
  const preview = html && htmlMode === 'preview'
  const { html: previewHtml, error: previewError } = usePreviewHtml(path, preview)
  const lineCount = content.split('\n').length
  const editable = !reader && !preview && lineCount <= EDITABLE_MAX_LINES
  // ≥90% coverage = whole-file noise (untracked); drop the tint, keep scroll.
  const effectiveHighlight =
    highlightRanges &&
    highlightRanges.reduce((n, r) => n + (r.end - r.start + 1), 0) / lineCount >= 0.9
      ? undefined
      : highlightRanges
  const scrollLine = line ?? effectiveHighlight?.[0]?.start
  const highlightLine = finding && findLine !== undefined ? findLine : scrollLine
  // Comments key on repo-relative paths; the viewer holds an absolute one.
  const commentIndex = useCommentIndex(relativeTo(repo?.path, path))

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (useTabsStore.getState().activePaneIndex !== paneIndex) return
      if (e.key === 'f' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        // Find is source-only; skip over reader/preview surfaces.
        if (reader || preview) return
        e.preventDefault()
        setFinding(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [paneIndex, reader, preview])

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 items-center justify-between gap-2 border-b px-3">
        <span className="truncate font-mono text-xs text-muted-foreground">
          {relativeTo(repo?.path, path)}
        </span>
        {markdown && <MarkdownModeToggle />}
        {html && <HtmlModeToggle />}
      </div>
      <div className="relative min-h-0 flex-1">
        {finding && !reader && !preview && (
          <FindBar content={content} onClose={() => setFinding(false)} onMatchLine={setFindLine} />
        )}
        {reader ? (
          <SourceContextMenu path={path}>
            <MarkdownView content={content} />
          </SourceContextMenu>
        ) : preview ? (
          previewError ? (
            <p className="p-4 text-sm text-destructive">{previewError.message}</p>
          ) : previewHtml === undefined ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : previewHtml === null ? (
            <p className="p-4 text-sm text-muted-foreground">
              HTML preview unavailable (missing or too large). Switch to Source to edit the raw
              file.
            </p>
          ) : (
            <HtmlView html={previewHtml} title={path.split('/').at(-1) ?? 'HTML preview'} />
          )
        ) : editable ? (
          <EditorSource
            path={path}
            initialContent={content}
            highlightLine={highlightLine}
            highlightRanges={effectiveHighlight}
            commentsByLine={commentIndex.byLine}
          />
        ) : (
          <SourceContextMenu path={path}>
            <SourceView
              path={path}
              content={content}
              highlightLine={highlightLine}
              highlightRanges={effectiveHighlight}
              commentsByLine={commentIndex.byLine}
            />
          </SourceContextMenu>
        )}
      </div>
    </div>
  )
}
