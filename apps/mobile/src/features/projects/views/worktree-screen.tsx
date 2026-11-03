import { Stack, useLocalSearchParams } from 'expo-router';
import { Box } from '../../../components/ui/box';
import { Card } from '../../../components/ui/card';
import { Icon } from '../../../components/ui/icon';
import { IconTile } from '../../../components/ui/icon-tile';
import { Item } from '../../../components/ui/item';
import { Screen } from '../../../components/ui/screen';
import { Separator } from '../../../components/ui/separator';
import { Text } from '../../../components/ui/text';
import { useOpenPullRequest } from './open-pull-request';
import { useWorkspacePickerModel } from './workspace-picker-model';
import { useOpenInWorktree } from './open-in-worktree';
import { PickerNotices } from './picker-notices';

export function WorktreeScreen() {
  const openPullRequest = useOpenPullRequest();
  const params = useLocalSearchParams<{
    title?: string;
    project?: string;
    computer?: string;
    environment?: string;
    projectId?: string;
    worktreeId?: string;
    review?: string;
    reviewId?: string;
    number?: string;
  }>();
  const { picker, reading } = useWorkspacePickerModel();
  const openIn = useOpenInWorktree(picker.onWorktree);
  const openInWorktree = (pathname: '/review' | '/files' | '/history') => {
    if (params.environment && params.projectId && params.worktreeId)
      openIn(
        {
          environmentId: params.environment,
          projectId: params.projectId,
          worktreeId: params.worktreeId,
        },
        pathname,
      );
  };
  const number = Number(params.number);
  const pullRequest =
    params.reviewId &&
    params.environment &&
    params.projectId &&
    Number.isInteger(number) &&
    number > 0
      ? {
          environmentId: params.environment,
          projectId: params.projectId,
          reviewId: params.reviewId,
          number,
        }
      : undefined;
  const chevron = <Icon name="chevron" tone="muted" />;
  return (
    <Screen layout="scroll" testID="worktree-screen">
      <Stack.Screen options={{ title: params.title ?? 'Worktree' }} />
      <Box className="w-full max-w-2xl self-center" gap={4} padding={4}>
        <Text variant="caption" tone="muted">
          {[params.project, params.computer].filter(Boolean).join(' · ')}
        </Text>
        <Card>
          <Item
            testID="worktree-review"
            title="Review"
            description={params.review || 'No published review'}
            leading={<IconTile name="checklist" />}
            trailing={chevron}
            disabled={picker.disabled}
            onPress={() => openInWorktree('/review')}
          />
          <Separator />
          <Item
            testID="worktree-files"
            title="Files"
            leading={<IconTile name="files" />}
            trailing={chevron}
            disabled={picker.disabled}
            onPress={() => openInWorktree('/files')}
          />
          <Separator />
          <Item
            testID="worktree-history"
            title="History"
            leading={<IconTile name="history" />}
            trailing={chevron}
            disabled={picker.disabled}
            onPress={() => openInWorktree('/history')}
          />
          {pullRequest ? (
            <>
              <Separator />
              <Item
                testID="worktree-pull-request"
                title={`Pull request #${number}`}
                leading={<IconTile name="review" />}
                trailing={chevron}
                onPress={() => openPullRequest(pullRequest)}
              />
            </>
          ) : null}
        </Card>
        <PickerNotices
          messages={[]}
          error={picker.error}
          onRead={picker.onRead}
          reading={reading}
        />
      </Box>
    </Screen>
  );
}
