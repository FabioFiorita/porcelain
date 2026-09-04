import { runUserAction } from '@porcelain/shared/background'
import { Alert } from 'react-native'

import { CommentComposerSheet } from './comment-composer-sheet'
import { useCommentActions } from './comment-data'
import { describeAnchor } from './comment-threads'
import { anchorRange, type CommentAnchor } from './line-range'

/**
 * Files a comment against an anchor: a whole file, or the line range a `SelectionBar` handed
 * off. One instance per surface (Files, a diff, a commit) — each keeps its own anchor state and
 * mounts this unconditionally, the same shape `ConfirmDialog` uses, so the sheet animates open
 * rather than mounting fresh when an anchor lands.
 */
export function CommentComposer({
  anchor,
  onClose,
  testIDPrefix,
}: {
  anchor: CommentAnchor | null
  onClose: () => void
  testIDPrefix: string
}): React.JSX.Element {
  const actions = useCommentActions()

  return (
    <CommentComposerSheet
      anchorLabel={anchor === null ? '' : describeAnchor(anchorRange(anchor))}
      open={anchor !== null}
      pending={actions.isPending}
      subject={anchor?.path ?? ''}
      testIDPrefix={testIDPrefix}
      onClose={onClose}
      onSubmit={(body) => {
        if (anchor === null) return
        const range = anchorRange(anchor)
        onClose()
        runUserAction(
          () =>
            actions.add(
              anchor.scope !== undefined || anchor.side !== undefined
                ? { body, anchor: { kind: 'file', ...anchor } }
                : {
                    body,
                    path: anchor.path,
                    ...(anchor.anchorText === undefined ? {} : { anchorText: anchor.anchorText }),
                    ...(range === null
                      ? {}
                      : { endLine: range.endLine, startLine: range.startLine }),
                  },
            ),
          (error: unknown) => {
            Alert.alert(
              'Could not add the comment',
              error instanceof Error ? error.message : String(error),
            )
          },
        )
      }}
    />
  )
}
