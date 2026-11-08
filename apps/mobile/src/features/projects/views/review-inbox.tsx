import { useAtom, useAtomRef, useAtomValue } from '@effect/atom-react';
import type { ListDetailMode } from '../../../shared/rules/list-detail';
import {
  openedReview,
  requestDocumentLeave,
  useWorktreeNavigator,
} from '../store';
import { readReviewInbox } from '@porcelain/client/projects';
import {
  navigatorEntrySelected,
  navigatorChecksLabel,
  searchReviewInbox,
  type ReviewInboxRow,
} from '@porcelain/client/projects/rules';
import { Fragment, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Text } from '../../../components/ui/text';
import { Box } from '../../../components/ui/box';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { GroupHeader } from '../../../components/ui/group-header';
import { Icon } from '../../../components/ui/icon';
import { Item } from '../../../components/ui/item';
import { Loading } from '../../../components/ui/loading';
import { Screen } from '../../../components/ui/screen';
import { Separator } from '../../../components/ui/separator';
import { remoteConnectionState } from '../../../shared/application/store';
import {
  useEnvironments,
  useEnvironmentStorageStatus,
  useReadEnvironments,
} from '../../access';
import { useOpenComputers } from './open-computers';
import { useOpenPublishedReview } from './open-published-review';
import { useOpenInWorktree } from './open-in-worktree';
import { PickerNotices } from './picker-notices';
import { NavigatorFilter } from './navigator-filter';
import { useWorkspacePickerModel } from './workspace-picker-model';

export function ReviewInbox({ mode }: { mode: ListDetailMode }) {
  const [selectedReview, selectReview] = useAtom(openedReview);
  const selection = selectedReview
    ? { kind: 'review' as const, ...selectedReview }
    : undefined;
  const remotes = useAtomRef(remoteConnectionState);
  const connections = remotes.map((entry) => entry.connection);
  const {
    inbox: all,
    loading,
    messages,
    filters,
  } = useAtomValue(readReviewInbox(connections));
  const [query, setQuery] = useState('');
  const { filter, setFilter } = useWorktreeNavigator();
  const inbox = searchReviewInbox(all, query);
  const paired = useEnvironments();
  const storage = useEnvironmentStorageStatus();
  const readEnvironments = useReadEnvironments();
  const { picker, checkout, initializing, reading } = useWorkspacePickerModel();
  const router = useRouter();
  const openComputers = useOpenComputers();
  const openPublishedReview = useOpenPublishedReview();
  const openInWorktree = useOpenInWorktree(picker.onWorktree);
  const open = (row: ReviewInboxRow) => {
    const review = {
      reviewId: row.review.reviewId,
      environmentId: row.entry.environmentId,
    };
    if (row.entry.worktreeId && row.entry.path && row.entry.available) {
      const target = {
        environmentId: row.entry.environmentId,
        projectId: row.entry.projectId,
        worktreeId: row.entry.worktreeId,
      };
      const navigate = () =>
        openInWorktree(target, (workspace) => {
          if (mode === 'beside') selectReview({ ...review, workspace });
          else
            router.push({
              pathname: '/review',
              params: { workspace, ...review },
            });
        });
      if (
        checkout?.environmentId === target.environmentId &&
        checkout.worktreeId === target.worktreeId
      )
        requestDocumentLeave(navigate);
      else navigate();
    } else if (mode === 'beside')
      requestDocumentLeave(() => selectReview(review));
    else openPublishedReview(review);
  };
  const rowItem = (
    row: ReviewInboxRow,
    withProject: boolean,
    index: number,
  ) => {
    const pull =
      row.review.pullRequestNumber === undefined
        ? undefined
        : `PR #${row.review.pullRequestNumber}`;
    const failed =
      row.review.checks?.state === 'available' &&
      row.review.checks.result === 'failed';
    return (
      <Fragment key={row.key}>
        {index > 0 ? <Separator inset="leading" /> : null}
        <Item
          title={row.entry.detached ? row.entry.name : row.entry.branch}
          titleNumberOfLines={1}
          description={[
            withProject ? row.entry.projectName : undefined,
            withProject && paired.length > 1
              ? row.entry.environmentName
              : undefined,
            row.label,
            pull,
          ]
            .filter(Boolean)
            .join(' · ')}
          descriptionNumberOfLines={1}
          leading={<Icon name="file" tone="muted" />}
          trailing={
            failed || mode === 'stack' ? (
              <Box className="flex-row items-center" gap={2}>
                {failed ? <Icon name="warning" tone="destructive" /> : null}
                {mode === 'stack' ? <Icon name="chevron" tone="muted" /> : null}
              </Box>
            ) : undefined
          }
          disabled={picker.disabled}
          selected={
            mode === 'beside' && navigatorEntrySelected(row.entry, selection)
          }
          selectionTone="neutral"
          accessibilityLabel={[
            row.entry.branch,
            row.entry.projectName,
            row.entry.environmentName,
            row.review.pullRequestNumber === undefined
              ? undefined
              : navigatorChecksLabel(row.review.checks),
            row.label,
            pull,
          ]
            .filter(Boolean)
            .join(', ')}
          testID={`review-inbox-${row.review.reviewId}`}
          onPress={() => open(row)}
        />
      </Fragment>
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
  const empty = inbox.decisions.length === 0 && inbox.projects.length === 0;
  const pending =
    storage.status !== 'ready' || initializing || loading || inbox.reading;
  const searching = query.trim() !== '';
  return (
    <>
      <Stack.SearchBar
        placeholder="Search reviews"
        autoCapitalize="none"
        hideWhenScrolling={false}
        onChangeText={(event) => setQuery(event.nativeEvent.text)}
        onCancelButtonPress={() => setQuery('')}
      />
      <Screen
        layout="scroll"
        testID="review-inbox"
        accessibilityLabel="Reviews by project"
      >
        <Box gap={4} paddingY={2}>
          <Box className="items-start" paddingX={4}>
            <NavigatorFilter
              view="reviews"
              sections={filters}
              filter={filter}
              onChange={setFilter}
            />
          </Box>
          {inbox.decisions.length > 0 ? (
            <Box>
              <GroupHeader
                label="Decision reviews"
                count={inbox.decisions.length}
              />
              {inbox.decisions.map((row, index) => rowItem(row, true, index))}
            </Box>
          ) : null}
          {inbox.projects.map((project) => (
            <Box key={project.key}>
              <Box paddingX={4} paddingY={2} gap={0.5}>
                <Text variant="secondary" weight="semibold" numberOfLines={1}>
                  {project.name}
                </Text>
                {paired.length > 1 ? (
                  <Box
                    className="min-w-0 flex-row items-center"
                    gap={1}
                    accessible
                    accessibilityLabel={`Computer: ${project.environmentName}`}
                  >
                    <Icon name="environments" size="caption" tone="muted" />
                    <Text
                      variant="caption"
                      tone="muted"
                      numberOfLines={1}
                      className="min-w-0 flex-1"
                    >
                      {project.environmentName}
                    </Text>
                  </Box>
                ) : null}
              </Box>
              {project.rows.map((row, index) => rowItem(row, false, index))}
            </Box>
          ))}
          {empty && pending ? <Loading label="Reading reviews…" /> : null}
          {empty && searching && !pending ? (
            <Empty
              title="No reviews match"
              description="Search by branch, project or computer."
            />
          ) : null}
          {empty && !pending && !searching ? (
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
    </>
  );
}
