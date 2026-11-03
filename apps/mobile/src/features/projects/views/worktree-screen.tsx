import { Stack, useLocalSearchParams } from 'expo-router';
import { Box } from '../../../components/ui/box';
import { Card } from '../../../components/ui/card';
import { Icon } from '../../../components/ui/icon';
import { StatusTile } from '../../../components/ui/status-tile';
import { Item } from '../../../components/ui/item';
import { Screen } from '../../../components/ui/screen';
import { Separator } from '../../../components/ui/separator';
import { Text } from '../../../components/ui/text';
import { useOpenPullRequest } from './open-pull-request';
import { useWorkspacePickerModel } from './workspace-picker-model';
import { useOpenInWorktree } from './open-in-worktree';
import { PickerNotices } from './picker-notices';

export type WorktreeDetails = {
  title: string;
  project: string;
  computer: string;
  environment: string;
  projectId: string;
  worktreeId: string;
  review: string;
  reviewId?: string | undefined;
  number?: string | undefined;
};

export function WorktreeScreen() {
  const params = useLocalSearchParams<Partial<WorktreeDetails>>();
  return (
    <>
      <Stack.Screen options={{ title: params.title ?? 'Worktree' }} />
      <WorktreeDetail params={params} />
    </>
  );
}

export function WorktreeDetail({
  params,
  heading = false,
}: {
  params: Partial<WorktreeDetails>;
  heading?: boolean;
}) {
  const openPullRequest = useOpenPullRequest();
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
      <Box className="w-full max-w-2xl self-center" gap={4} padding={4}>
        {heading ? (
          <Text variant="title" accessibilityRole="header">
            {params.title ?? 'Worktree'}
          </Text>
        ) : null}
        <Text variant="caption" tone="muted">
          {[params.project, params.computer].filter(Boolean).join(' · ')}
        </Text>
        <Card>
          <Item
            testID="worktree-review"
            title="Review"
            description={params.review || 'No published review'}
            leading={<StatusTile name="checklist" tone="muted" />}
            trailing={chevron}
            disabled={picker.disabled}
            onPress={() => openInWorktree('/review')}
          />
          <Separator inset="leading" />
          <Item
            testID="worktree-files"
            title="Files"
            leading={<StatusTile name="files" tone="muted" />}
            trailing={chevron}
            disabled={picker.disabled}
            onPress={() => openInWorktree('/files')}
          />
          <Separator inset="leading" />
          <Item
            testID="worktree-history"
            title="History"
            leading={<StatusTile name="history" tone="muted" />}
            trailing={chevron}
            disabled={picker.disabled}
            onPress={() => openInWorktree('/history')}
          />
          {pullRequest ? (
            <>
              <Separator inset="leading" />
              <Item
                testID="worktree-pull-request"
                title={`Pull request #${number}`}
                leading={<StatusTile name="review" tone="muted" />}
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
