import { useRouter } from 'expo-router';
import { useAtomRef, useAtomValue } from '@effect/atom-react';
import { readReviewInbox } from '@porcelain/client/projects';
import type {
  ReviewInboxRow,
  ReviewInboxStatus,
} from '@porcelain/client/projects/rules';
import { Box } from '../../../components/ui/box';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { GroupHeader } from '../../../components/ui/group-header';
import { Icon, type IconName } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { Loading } from '../../../components/ui/loading';
import { Screen } from '../../../components/ui/screen';
import { StatusTile } from '../../../components/ui/status-tile';
import { remoteConnectionState } from '../../../shared/application/store';
import {
  useEnvironments,
  useEnvironmentStorageStatus,
  useReadEnvironments,
} from '../../access';
import { useOpenComputers } from './open-computers';
import { useOpenPublishedReview } from './open-published-review';
import { PickerNotices } from './picker-notices';
import { useWorkspacePickerModel } from './workspace-picker-model';

const statusTiles: Record<
  ReviewInboxStatus,
  { name: IconName; tone: 'brand' | 'add' | 'warn' | 'muted' }
> = {
  'needs-you': { name: 'reviewWaiting', tone: 'brand' },
  reviewed: { name: 'reviewDone', tone: 'add' },
  reading: { name: 'reviewReading', tone: 'muted' },
  unavailable: { name: 'warning', tone: 'warn' },
};

export function ReviewInbox() {
  const router = useRouter();
  const remotes = useAtomRef(remoteConnectionState);
  const connections = remotes.map((entry) => entry.connection);
  const { inbox, loading, messages } = useAtomValue(
    readReviewInbox(connections),
  );
  const paired = useEnvironments();
  const storage = useEnvironmentStorageStatus();
  const readEnvironments = useReadEnvironments();
  const { picker, initializing, reading } = useWorkspacePickerModel();
  const openComputers = useOpenComputers();
  const openPublishedReview = useOpenPublishedReview();
  const open = (row: ReviewInboxRow) => {
    const { entry } = row;
    if (entry.available && entry.worktreeId)
      picker.onWorktree(
        entry.environmentId,
        entry.projectId,
        entry.worktreeId,
        () => router.push('/review'),
      );
    else
      openPublishedReview({
        reviewId: row.review.reviewId,
        environmentId: entry.environmentId,
      });
  };
  const rowItem = (row: ReviewInboxRow, withProject: boolean) => {
    const pull =
      row.review.pullRequestNumber === undefined
        ? undefined
        : `PR #${row.review.pullRequestNumber}`;
    return (
      <Item
        key={row.key}
        title={row.entry.detached ? row.entry.name : row.entry.branch}
        titleNumberOfLines={1}
        description={[
          withProject ? row.entry.projectName : undefined,
          row.label,
          pull,
        ]
          .filter(Boolean)
          .join(' · ')}
        descriptionNumberOfLines={1}
        leading={<StatusTile {...statusTiles[row.status]} />}
        trailing={<Icon name="chevron" tone="muted" />}
        disabled={picker.disabled}
        accessibilityLabel={[
          row.entry.branch,
          row.entry.projectName,
          row.entry.environmentName,
          row.status === 'needs-you' ? 'Needs you' : undefined,
          row.label,
          pull,
        ]
          .filter(Boolean)
          .join(', ')}
        testID={`review-inbox-${row.review.reviewId}`}
        onPress={() => open(row)}
      />
    );
  };
  if (storage.error)
    return (
      <Screen layout="scroll" testID="review-inbox">
        <Box padding={4}>
          <ErrorState
            message={storage.error}
            retry={{
              label: 'Try again',
              onPress: () => readEnvironments(undefined),
            }}
          />
        </Box>
      </Screen>
    );
  if (storage.status === 'ready' && paired.length === 0)
    return (
      <Screen layout="scroll" testID="review-inbox">
        <Empty
          title="Pair a computer"
          description="Reviews your agents publish on a paired computer appear here."
          action={{ label: 'Add computer', onPress: openComputers }}
        />
      </Screen>
    );
  const empty = inbox.needsYou.length === 0 && inbox.projects.length === 0;
  const pending =
    storage.status !== 'ready' || initializing || loading || inbox.reading;
  return (
    <Screen
      layout="scroll"
      testID="review-inbox"
      accessibilityLabel="Reviews by project"
    >
      <Box gap={4} padding={2}>
        {inbox.needsYou.length > 0 ? (
          <Box gap={1}>
            <GroupHeader label="Needs you" count={inbox.needsYou.length} />
            {inbox.needsYou.map((row) => rowItem(row, true))}
          </Box>
        ) : null}
        {inbox.projects.map((project) => (
          <Box key={project.key} gap={1}>
            <GroupHeader
              label={
                paired.length > 1
                  ? `${project.name} · ${project.environmentName}`
                  : project.name
              }
            />
            {project.rows.map((row) => rowItem(row, false))}
          </Box>
        ))}
        {empty && pending ? <Loading label="Reading reviews…" /> : null}
        {empty && !pending ? (
          <Empty
            title="No reviews"
            description="When an agent publishes a review of its work, it appears here."
          />
        ) : null}
        <PickerNotices
          messages={messages}
          error={picker.error}
          onRead={picker.onRead}
          reading={reading}
        />
      </Box>
    </Screen>
  );
}
