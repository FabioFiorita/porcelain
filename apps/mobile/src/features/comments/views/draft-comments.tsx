import { useRouter } from 'expo-router';
import type { DraftComment } from '@porcelain/client/comments/rules';
import { Box } from '../../../components/ui/box';
import { Card } from '../../../components/ui/card';
import { IconButton } from '../../../components/ui/icon-button';
import { Text } from '../../../components/ui/text';
import { useWritesBlocked } from '../../access';
import type { Workspace } from '../../projects/index';
import { useRemoveComment } from '../commands/comments';
import { editCommentParams } from '../rules/comment-target';

function DraftCard({
  workspace,
  comment,
  location,
  onEdit,
}: {
  workspace: Pick<Workspace, 'key' | 'connection' | 'scope'>;
  comment: DraftComment;
  location?: string | undefined;
  onEdit: (() => void) | undefined;
}) {
  const remove = useRemoveComment(workspace);
  const blocked = useWritesBlocked(workspace.connection.environmentId);
  const published = comment.publication.status === 'published';
  return (
    <Card padding={2} gap={1}>
      <Box className="min-h-8 flex-row items-center" gap={2}>
        <Box className="min-w-0 flex-1 flex-row items-center" gap={2}>
          {location ? (
            <Text
              variant="caption"
              tone="muted"
              numberOfLines={1}
              className="shrink"
            >
              {location}
            </Text>
          ) : null}
          <Text variant="caption" tone="muted">
            {published ? 'Posted' : 'Draft'}
          </Text>
          {comment.outdated ? (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              Outdated · the lines changed
            </Text>
          ) : null}
        </Box>
        {!published && onEdit ? (
          <IconButton
            icon="edit"
            size="sm"
            accessibilityLabel="Edit comment"
            disabled={blocked}
            onPress={onEdit}
          />
        ) : null}
        {!published ? (
          <IconButton
            icon="trash"
            size="sm"
            accessibilityLabel="Delete comment"
            disabled={blocked}
            pending={remove.waiting}
            onPress={() => void remove.run(comment.id)}
          />
        ) : null}
      </Box>
      <Box paddingX={2}>
        <Text variant="secondary" selectable>
          {comment.text}
        </Text>
      </Box>
      {remove.failure ? (
        <Box paddingX={2}>
          <Text variant="caption" tone="destructive" accessibilityRole="alert">
            {remove.failure}
          </Text>
        </Box>
      ) : null}
    </Card>
  );
}

export function DraftComments({
  workspace,
  drafts,
  locations = false,
  onEdit,
}: {
  workspace: Pick<Workspace, 'key' | 'connection' | 'scope'>;
  drafts: readonly DraftComment[];
  locations?: ((comment: DraftComment) => string) | false;
  onEdit?: ((comment: DraftComment) => void) | undefined;
}) {
  const router = useRouter();
  if (drafts.length === 0) return null;
  const edit =
    onEdit ??
    ((comment: DraftComment) =>
      router.push({
        pathname: '/comment',
        params: editCommentParams(workspace.key, comment.id),
      }));
  return (
    <Box gap={2}>
      {drafts.map((comment) => (
        <DraftCard
          key={comment.id}
          workspace={workspace}
          comment={comment}
          location={locations ? locations(comment) : undefined}
          onEdit={() => edit(comment)}
        />
      ))}
    </Box>
  );
}
