import type { ReviewComment } from '@porcelain/contracts/review'
import { ScrollView, Text, View } from 'react-native'

import { ErrorNote } from '@/components/panel-chrome'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Sheet } from '@/components/ui/sheet'
import { CommentComposer, SelectionBar } from '@/features/comments'
import type { HtmlMode, MarkdownMode } from '@/features/settings/preferences-store'
import { useResolvedColorScheme } from '@/features/settings/theme-provider'
import { useBottomChrome } from '@/features/shell/window-chrome'

import { FileViewerBody, HtmlPreviewBody } from './file-viewer-body'
import { FileViewerHeader } from './file-viewer-header'
import { markdownToHtml, readerDocument } from './preview-document'
import { PreviewView } from './preview-view'
import { useFileViewer } from './use-file-viewer'

/**
 * One file, whole — the Files tab's viewer.
 *
 * The same reading surface as the diff, minus the diff: syntax colour from the same VS Code
 * theme, the same gutter, the same long-press-then-tap line selection, and the same composer
 * on the other end of it. That last part is the point of reading a file on a phone at all —
 * a comment filed here reaches the agent through the same channel as one filed on a diff.
 *
 * A markdown or HTML file also has a rendered face. Which one it opens in is the Settings
 * preference; the toggle above the content overrides that choice **for this file only** and
 * never writes back to the default — see `viewer-mode.ts`. Source stays the surface that
 * carries line numbers and comment markers. Rendered Markdown preserves source positions so a
 * native text selection can file the same line-ranged comment without switching faces.
 *
 * The state behind all of that is `use-file-viewer.ts`; this file is the markup.
 */
export function FileViewer({
  active,
  filePath,
  line,
  onBack,
}: {
  active: boolean
  /** Repo-relative. */
  filePath: string
  /** 1-based line to scroll to and tint — a search hit, opened where it matched. */
  line?: number
  /** Phone: pop back to the browser. Omitted on tablet, where the list is always on screen. */
  onBack?: () => void
  /** Phone: this view replaces the tab header, so it owns the status-bar inset. */
}): React.JSX.Element {
  const bottomInset = useBottomChrome()
  const scheme = useResolvedColorScheme()
  const viewer = useFileViewer({ active, filePath, line })

  return (
    <View className="flex-1 bg-background" testID="porcelain-files-viewer">
      <FileViewerHeader
        commentCount={viewer.commentCount}
        filePath={filePath}
        isPinned={viewer.isPinned}
        onBack={onBack}
        onComment={viewer.comment}
        onOpenComments={viewer.openComments}
        onTogglePinned={viewer.togglePinned}
        selectedRange={viewer.anchorable}
      />

      {viewer.actionError === null ? null : (
        <View className="px-4 py-2">
          <ErrorNote message={viewer.actionError} testID="porcelain-files-viewer-action-error" />
        </View>
      )}

      {viewer.toggle === null ? null : (
        <View className="px-4 py-2">
          {viewer.toggle === 'markdown' ? (
            <SegmentedControl<MarkdownMode>
              options={[
                { value: 'reader', label: 'Reader', testID: 'porcelain-files-mode-reader' },
                { value: 'source', label: 'Source', testID: 'porcelain-files-mode-source' },
              ]}
              testID="porcelain-files-markdown-mode"
              value={viewer.markdownMode}
              onChange={viewer.setMarkdownMode}
            />
          ) : (
            <SegmentedControl<HtmlMode>
              options={[
                { value: 'preview', label: 'Preview', testID: 'porcelain-files-mode-preview' },
                { value: 'source', label: 'Source', testID: 'porcelain-files-mode-html-source' },
              ]}
              testID="porcelain-files-html-mode"
              value={viewer.htmlMode}
              onChange={viewer.setHtmlMode}
            />
          )}
        </View>
      )}

      {viewer.face === 'reader' ? (
        <PreviewView
          document={readerDocument(markdownToHtml(viewer.content), scheme)}
          onSelection={viewer.selectRendered}
          testID="porcelain-files-reader"
        />
      ) : viewer.face === 'preview' ? (
        <HtmlPreviewBody
          error={viewer.htmlPreview.error}
          html={viewer.htmlPreview.html}
          isLoading={viewer.htmlPreview.isLoading}
        />
      ) : (
        <FileViewerBody
          ctx={viewer.ctx}
          error={viewer.error}
          filePath={filePath}
          isLoading={viewer.isLoading}
          line={line}
          rows={viewer.rows}
          view={viewer.view}
        />
      )}

      {viewer.anchorable === null ? null : (
        <SelectionBar
          bottomInset={bottomInset}
          path={filePath}
          range={viewer.anchorable}
          testIDPrefix="porcelain-files-selection"
          onCancel={viewer.clearSelection}
          onComment={viewer.comment}
        />
      )}
      <CommentComposer
        anchor={viewer.anchor}
        testIDPrefix="porcelain-files-comment"
        onClose={viewer.clearAnchor}
      />
      <FileCommentsSheet
        comments={viewer.comments}
        filePath={filePath}
        line={viewer.commentsLine}
        open={viewer.commentsOpen}
        onClose={viewer.closeComments}
      />
    </View>
  )
}

function FileCommentsSheet({
  comments,
  filePath,
  line,
  open,
  onClose,
}: {
  comments: readonly ReviewComment[]
  filePath: string
  line: number | null
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const related = comments.filter((comment) => {
    if (comment.path !== filePath) return false
    if (line === null) return true
    if (comment.anchor?.kind !== 'file' || comment.anchor.startLine === undefined) return false
    return (
      line >= comment.anchor.startLine &&
      line <= (comment.anchor.endLine ?? comment.anchor.startLine)
    )
  })
  return (
    <Sheet
      open={open}
      scrollable
      testID="porcelain-files-comments"
      title="File comments"
      onClose={onClose}
    >
      <ScrollView className="px-4 pb-6">
        {related.map((comment) => (
          <View
            key={comment.id}
            className="mb-3 rounded-lg border border-border bg-background p-3"
            testID={`porcelain-files-comment-${comment.id}`}
          >
            <Text className="text-3xs font-semibold uppercase text-muted-foreground">
              {comment.author === 'agent' ? 'Agent' : 'You'}
            </Text>
            <Text className="mt-1 text-sm text-foreground">{comment.body}</Text>
            {comment.agentReply === undefined ? null : (
              <View className="mt-2 border-l-2 border-border pl-2">
                <Text className="text-3xs font-semibold uppercase text-muted-foreground">
                  Agent
                </Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  {comment.agentReply.body}
                </Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </Sheet>
  )
}
