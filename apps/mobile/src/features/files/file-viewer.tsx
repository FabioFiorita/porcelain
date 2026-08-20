import { View } from 'react-native'

import { ErrorNote } from '@/components/panel-chrome'
import { SegmentedControl } from '@/components/native/segmented-control'
import { CommentComposer, SelectionBar } from '@/features/comments'
import type { HtmlMode, MarkdownMode } from '@/features/settings/preferences-store'
import { useResolvedColorScheme } from '@/features/settings/theme-provider'
import { useBottomChrome } from '@/features/shell/bottom-chrome'

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
 * carries line numbers, comment markers and selection — a comment anchors to a line, and a
 * rendered page has none.
 *
 * The state behind all of that is `use-file-viewer.ts`; this file is the markup.
 */
export function FileViewer({
  active,
  filePath,
  line,
  onBack,
  topInset = 0,
}: {
  active: boolean
  /** Repo-relative. */
  filePath: string
  /** 1-based line to scroll to and tint — a search hit, opened where it matched. */
  line?: number
  /** Phone: pop back to the browser. Omitted on tablet, where the list is always on screen. */
  onBack?: () => void
  /** Phone: this view replaces the tab header, so it owns the status-bar inset. */
  topInset?: number
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
        onTogglePinned={viewer.togglePinned}
        selectedRange={viewer.anchorable}
        topInset={topInset}
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

      {/* A rendered page has no line numbers, so a range selected in Source has nothing to
          point at here — the bar waits for the toggle to come back rather than hovering over
          content it cannot describe. `anchorable` is that same rule. */}
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
    </View>
  )
}
