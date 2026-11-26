import { useState } from 'react';
import { Keyboard } from 'react-native';
import { Option, Schema } from 'effect';
import {
  anchorLabel,
  type CommentAnchor,
  type DraftComment,
} from '@porcelain/client/comments/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Empty } from '../../../components/ui/empty';
import { Input } from '../../../components/ui/input';
import { Sheet } from '../../../components/ui/sheet';
import { Spinner } from '../../../components/ui/spinner';
import { Text } from '../../../components/ui/text';
import { useWritesBlocked } from '../../access';
import { WorkspaceGate, type Workspace } from '../../projects/index';
import { useRemoveComment, useSaveComment } from '../commands/comments';
import { useComments } from '../queries/comments';
import { commentTargetSchema } from '../rules/comment-target';

const MAX_LENGTH = 8000;

const unavailable = <Empty title="This comment is no longer a draft." />;

export function CommentSheet({
  params,
  onClose,
}: {
  params: Record<string, string | string[] | undefined>;
  onClose: () => void;
}) {
  const target = Schema.decodeUnknownOption(commentTargetSchema)(params);
  if (Option.isNone(target))
    return (
      <Sheet title="Comment">
        <Empty title="This comment link is invalid." />
      </Sheet>
    );
  const value = target.value;
  return (
    <Sheet title={'anchor' in value ? anchorLabel(value.anchor) : 'Comment'}>
      <WorkspaceGate
        frame="pane"
        expectedWorkspace={value.workspace}
        changed={<Empty title="Another worktree is selected now." />}
      >
        {(selected) =>
          'anchor' in value ? (
            <CommentForm
              workspace={selected}
              anchor={value.anchor}
              onClose={onClose}
            />
          ) : (
            <EditComment
              workspace={selected}
              commentId={value.commentId}
              onClose={onClose}
            />
          )
        }
      </WorkspaceGate>
    </Sheet>
  );
}

function EditComment({
  workspace,
  commentId,
  onClose,
}: {
  workspace: Workspace;
  commentId: string;
  onClose: () => void;
}) {
  const { view } = useComments(workspace);
  const comment = view?.comments.find(
    (entry) => entry.id === commentId && entry.publication.status === 'draft',
  );
  if (!view) return <Spinner />;
  if (!comment) return unavailable;
  return (
    <>
      <Text variant="secondary" tone="muted" numberOfLines={2}>
        {anchorLabel(comment.anchor)}
      </Text>
      <CommentForm
        workspace={workspace}
        anchor={comment.anchor}
        comment={comment}
        onClose={onClose}
      />
    </>
  );
}

export function CommentForm({
  workspace,
  anchor,
  comment,
  onClose,
}: {
  workspace: Workspace;
  anchor: CommentAnchor;
  comment?: DraftComment | undefined;
  onClose: () => void;
}) {
  const [text, setText] = useState(comment?.text ?? '');
  const save = useSaveComment(workspace);
  const remove = useRemoveComment(workspace);
  const blocked = useWritesBlocked(workspace.connection.environmentId);
  const trimmed = text.trim();
  const submit = () => {
    if (!trimmed || save.waiting || blocked) return;
    Keyboard.dismiss();
    void (
      comment ? save.edit(comment.id, trimmed) : save.add(anchor, trimmed)
    ).then((view) => {
      if (view) onClose();
    });
  };
  const failure = save.failure ?? remove.failure;
  return (
    <Box gap={3}>
      <Input
        multiline
        autoFocus
        value={text}
        maxLength={MAX_LENGTH}
        accessibilityLabel={comment ? 'Edit comment' : 'New comment'}
        placeholder="Leave a comment"
        disabled={save.waiting}
        onChangeText={setText}
      />
      {failure ? (
        <Text variant="caption" tone="destructive" accessibilityRole="alert">
          {failure}
        </Text>
      ) : null}
      <Button
        label={comment ? 'Save' : 'Comment'}
        pending={save.waiting}
        disabled={!trimmed || blocked}
        onPress={submit}
      />
      {comment ? (
        <Button
          label="Delete comment"
          variant="destructivePlain"
          pending={remove.waiting}
          disabled={blocked}
          onPress={() =>
            void remove.run(comment.id).then((view) => {
              if (view) onClose();
            })
          }
        />
      ) : null}
      <Text variant="caption" tone="muted">
        Drafts stay on this computer until you publish them.
      </Text>
    </Box>
  );
}
