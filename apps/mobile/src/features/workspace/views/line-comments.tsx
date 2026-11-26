import { useAtom } from '@effect/atom-react';
import { useRouter } from 'expo-router';
import {
  anchorPath,
  commentsAt,
  type CommentAnchor,
} from '@porcelain/client/comments/rules';
import {
  editCommentParams,
  newCommentParams,
  useComments,
} from '../../comments/index';
import type { ReviewRange } from '../../../components/ui/code-range';
import { FloatingBar } from '../../../components/ui/floating-bar';
import { Button } from '../../../components/ui/button';
import { IconButton } from '../../../components/ui/icon-button';
import { Text } from '../../../components/ui/text';
import type { TopBarAction } from '../../../components/ui/top-bar-items';
import type { RenderLine } from '../../../shared/rules/render-model';
import type { Workspace } from '../../projects/index';
import {
  lineCommentAnchor,
  noteComment,
  selectionLabel,
  withDraftNotes,
} from '../rules/line-comments';
import { lineSelection } from '../store';

type CommentTarget = { anchor: CommentAnchor } | { commentId: string };

function useOpenComment(workspace: Workspace) {
  const router = useRouter();
  return (target: CommentTarget) =>
    router.push({
      pathname: '/comment',
      params:
        'anchor' in target
          ? newCommentParams(workspace.key, target.anchor)
          : editCommentParams(workspace.key, target.commentId),
    });
}

export function useDraftComments(workspace: Workspace) {
  return useComments(workspace).view;
}

export type LineComments = {
  readonly selection: ReviewRange | undefined;
  readonly onSelect: (range: ReviewRange) => void;
  readonly decorate: (lines: readonly RenderLine[]) => readonly RenderLine[];
  readonly onExpand: (id: string) => void;
};

export function useLineComments({
  workspace,
  page,
  path,
  section = path,
  lines,
}: {
  workspace: Workspace;
  page: string;
  path: string;
  section?: string | undefined;
  lines: readonly RenderLine[];
}): LineComments {
  const view = useDraftComments(workspace);
  const open = useOpenComment(workspace);
  const [selected, setSelected] = useAtom(lineSelection(page));
  const drafts = commentsAt(view, (anchor) => anchorPath(anchor) === path);
  return {
    selection: selected?.section === section ? selected.range : undefined,
    onSelect: (range) =>
      setSelected({
        section,
        range,
        comment: lineCommentAnchor(path, lines, range),
      }),
    decorate: (shown) => withDraftNotes(shown, drafts),
    onExpand: (id) => {
      const commentId = noteComment(id);
      if (commentId) open({ commentId });
    },
  };
}

export function useFileCommentAction(
  workspace: Workspace,
  path: string,
): TopBarAction {
  const open = useOpenComment(workspace);
  return {
    kind: 'button',
    id: 'comment-file',
    label: 'Comment on this file',
    icon: 'comment',
    onPress: () => open({ anchor: { kind: 'file', path } }),
  };
}

export function LineSelectionBar({
  workspace,
  page,
}: {
  workspace: Workspace;
  page: string;
}) {
  const open = useOpenComment(workspace);
  const [selected, setSelected] = useAtom(lineSelection(page));
  if (!selected) return null;
  const { comment } = selected;
  return (
    <FloatingBar
      testID="line-selection"
      action={
        <IconButton
          icon="close"
          size="sm"
          accessibilityLabel="Clear selection"
          onPress={() => setSelected(undefined)}
        />
      }
    >
      <Text variant="secondary" weight="medium">
        {'refused' in comment
          ? comment.refused
          : selectionLabel(selected.range)}
      </Text>
      {'anchor' in comment ? (
        <Button
          label="Comment"
          size="sm"
          accessibilityLabel={`Comment on ${selectionLabel(selected.range).toLowerCase()}`}
          onPress={() => {
            setSelected(undefined);
            open({ anchor: comment.anchor });
          }}
        />
      ) : null}
    </FloatingBar>
  );
}
