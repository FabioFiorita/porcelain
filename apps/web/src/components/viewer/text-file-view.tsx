import { type CommentAnchor, CommentComposer } from '@renderer/components/git/comment-composer'
import { Button } from '@renderer/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { HtmlDocumentFrame, isHtmlPath } from '@renderer/components/viewer/html-view'
import { isMarkdownPath, MarkdownView } from '@renderer/components/viewer/markdown-view'
import { useFilePreview, useFilePreviewSrc } from '@renderer/features/files'
import { useCommentIndex } from '@renderer/features/review'
import { raisedCardClass, viewerWellClass } from '@renderer/lib/controls'
import { lineRangeForSelectedText } from '@renderer/lib/line-selection'
import { relativeTo } from '@renderer/lib/paths'
import { cn } from '@renderer/lib/utils'
import { useHubRepoPath } from '@renderer/stores/hub-repo'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useTabsStore } from '@renderer/stores/tabs'
import { TestIds } from '@shared/test-ids'
import { MessageSquarePlus } from 'lucide-react'
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
  /** Agent-changed line ranges from the Review outline (tinted in source). */
  highlightRanges?: { start: number; end: number }[]
  paneIndex: number
}): React.JSX.Element {
  const repoPath = useHubRepoPath() ?? undefined
  const markdownMode = usePreferencesStore((s) => s.markdownMode)
  const htmlMode = usePreferencesStore((s) => s.htmlMode) ?? 'preview'
  const [finding, setFinding] = useState(false)
  const [findLine, setFindLine] = useState<number | undefined>(undefined)
  const [commentAnchor, setCommentAnchor] = useState<CommentAnchor | null>(null)
  const [previewSelection, setPreviewSelection] = useState<string | null>(null)
  const relativePath = relativeTo(repoPath, path)
  const commentIndex = useCommentIndex(relativePath)
  const markdown = isMarkdownPath(path)
  const html = isHtmlPath(path)
  const reader = markdown && markdownMode === 'reader'
  const preview = html && htmlMode === 'preview'
  // Two halves of one surface: the query answers "is there a preview at all"
  // (missing / too large), the minted URL is where the frame points.
  const { html: previewHtml, error: previewError } = useFilePreview(path, preview)
  const previewSrc = useFilePreviewSrc(path, preview && previewHtml !== null)
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
  // Comments key on project-relative paths; the viewer holds an absolute one.

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (useTabsStore.getState().activePaneIndex !== paneIndex) return
      if (e.key === 'f' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        // Find is source-only; skip over reader/preview surfaces.
        if (reader || preview) return
        e.preventDefault()
        setFinding(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [paneIndex, reader, preview])

  return (
    <div data-testid={TestIds.codeWell} className={viewerWellClass}>
      <div
        data-testid={TestIds.codeCard}
        className={cn(raisedCardClass, 'flex h-full min-h-0 flex-col')}
      >
        <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b px-3">
          <span className="truncate font-mono text-xs text-muted-foreground">{relativePath}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setCommentAnchor({ path: relativePath })}
                    aria-label="Comment on file"
                  >
                    <MessageSquarePlus />
                  </Button>
                }
              />
              <TooltipContent>Comment on file</TooltipContent>
            </Tooltip>
            {markdown && <MarkdownModeToggle />}
            {html && <HtmlModeToggle />}
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          {finding && !reader && !preview && (
            <FindBar
              content={content}
              onClose={() => setFinding(false)}
              onMatchLine={setFindLine}
            />
          )}
          {reader ? (
            <SourceContextMenu path={path}>
              <MarkdownView content={content} commentsByLine={commentIndex.byLine} />
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
            ) : previewSrc === null ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="relative h-full">
                <HtmlDocumentFrame
                  src={previewSrc}
                  title={path.split('/').at(-1) ?? 'HTML preview'}
                  onSelection={setPreviewSelection}
                />
                {previewSelection !== null && (
                  <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-lg border bg-popover p-1 shadow-lg">
                    <Button
                      size="sm"
                      onClick={() => {
                        const range = lineRangeForSelectedText(content, previewSelection)
                        setCommentAnchor({
                          path: relativePath,
                          anchorText: previewSelection,
                          ...(range ? { startLine: range.startLine, endLine: range.endLine } : {}),
                        })
                        setPreviewSelection(null)
                      }}
                    >
                      <MessageSquarePlus /> Add comment
                    </Button>
                  </div>
                )}
              </div>
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
      <CommentComposer
        anchor={commentAnchor}
        open={commentAnchor !== null}
        onOpenChange={(open: boolean): void => {
          if (!open) setCommentAnchor(null)
        }}
      />
    </div>
  )
}
