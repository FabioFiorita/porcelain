import { useRouter } from 'expo-router';
import {
  commentSpread,
  draftCountLabel,
  openComments,
  postedComments,
} from '@porcelain/client/comments/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Text } from '../../../components/ui/text';
import type { Workspace } from '../../projects/index';
import { useComments } from '../queries/comments';

export function CommentsSummary({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const { view } = useComments(workspace);
  const open = openComments(view);
  const posted = postedComments(view).length;
  const publish = () =>
    router.push({
      pathname: '/publish-comments',
      params: { workspace: workspace.key },
    });
  if (open.length === 0 && posted === 0)
    return (
      <Text variant="secondary" tone="muted">
        No draft comments
      </Text>
    );
  return (
    <Box className="flex-row flex-wrap items-center justify-between" gap={2}>
      <Text variant="secondary" className="min-w-0 shrink">
        {open.length > 0 ? (
          <>
            {draftCountLabel(open.length)}
            <Text variant="secondary" tone="muted">
              {' '}
              · {commentSpread(open)}
            </Text>
          </>
        ) : (
          <Text variant="secondary" tone="muted">
            {posted === 1 ? '1 comment posted' : `${posted} comments posted`}
          </Text>
        )}
      </Text>
      <Button
        label={open.length > 0 ? 'Publish review' : 'Show'}
        variant="plain"
        size="sm"
        className="-mr-3.5"
        onPress={publish}
      />
    </Box>
  );
}
