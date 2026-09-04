import { fileName } from '@porcelain/client-runtime/paths'

import { IconAction, ScreenHeader } from '@/components/panel-chrome'
import { describeRange, type LineRange } from '@/features/comments'

/** The viewer's own chrome: what the file is, how much has been said about it, pin and comment. */
export function FileViewerHeader({
  commentCount,
  filePath,
  isPinned,
  onBack,
  onComment,
  onOpenComments,
  onTogglePinned,
  selectedRange,
}: {
  commentCount: number
  filePath: string
  isPinned: boolean
  onBack?: () => void
  onComment: () => void
  onOpenComments: () => void
  onTogglePinned: () => void
  /** The open selection the comment action would anchor to, or null for the whole file. */
  selectedRange: LineRange | null
}): React.JSX.Element {
  return (
    <ScreenHeader
      actions={
        <>
          {commentCount === 0 ? null : (
            <IconAction
              accessibilityLabel={`Open ${commentCount} file comments`}
              glyph="comment"
              testID="porcelain-files-viewer-comments"
              onPress={onOpenComments}
            />
          )}
          <IconAction
            accessibilityLabel={isPinned ? 'Unpin file' : 'Pin file'}
            glyph={isPinned ? 'pinOff' : 'pin'}
            selected={isPinned}
            testID="porcelain-files-viewer-pin"
            tone={isPinned ? 'primary' : 'muted'}
            onPress={onTogglePinned}
          />
          <IconAction
            accessibilityLabel={
              selectedRange === null
                ? 'Comment on file'
                : `Comment on ${describeRange(selectedRange).toLowerCase()}`
            }
            glyph="commentAdd"
            selected={selectedRange !== null}
            testID="porcelain-files-viewer-comment"
            tone={selectedRange === null ? 'muted' : 'primary'}
            onPress={onComment}
          />
        </>
      }
      back={
        onBack === undefined
          ? undefined
          : {
              accessibilityLabel: 'Back to files',
              onPress: onBack,
              testID: 'porcelain-files-viewer-back',
            }
      }
      mono
      subtitle={`${filePath}${commentCount === 0 ? '' : ` · ${commentCount} commented`}`}
      subtitleFromEnd
      title={fileName(filePath)}
    />
  )
}
