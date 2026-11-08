import type { ReviewComparison } from '../../../shared/rules/review-comparison';
import { Box } from '../../../components/ui/box';
import { Screen } from '../../../components/ui/screen';
import { useIsFocused, useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { Fragment, useState, type ComponentProps } from 'react';
import { useAtom, useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readBranchBases } from '@porcelain/client/changes';
import {
  changeStatusMarks,
  type ChangeStatus,
} from '@porcelain/client/files/rules';
import { refLabel } from '@porcelain/client/history/rules';
import { readCommentThreads } from '@porcelain/client/reviews';
import { changeAnchor } from '@porcelain/client/reviews/rules';
import { Empty } from '../../../components/ui/empty';
import { WorkspaceGate } from '../../projects';
import { Item } from '../../../components/ui/item';
import { Card } from '../../../components/ui/card';
import { Icon } from '../../../components/ui/icon';
import { Separator } from '../../../components/ui/separator';
import { Button } from '../../../components/ui/button';
import { Text } from '../../../components/ui/text';
import { StatusDot } from '../../../components/ui/status-dot';
import type { Workspace, OpenedReview } from '../../projects';
import { useWorkspaceReview } from '../queries/linked-review';
import { LinkedReviewPane } from './linked-review-screen';
import { useReviewSnapshot, useReviewMarks } from '../queries/review';
import {
  reviewFiles,
  snapshotChangeMarks,
  type ReviewFile,
} from '../rules/comparison';
import { reviewParams } from '../rules/navigation';
import { ReviewReadState } from './read-state';
import { phoneReviewComparison, useReviewListOffset } from '../store';
import { ComparisonMenu } from './comparison-menu';
import { PublishedOverview, PublishedOverviewBar } from './published-review';
import { PublishedWalkthrough } from './published-walkthrough';

export function ReviewScreen({
  workspace,
  review,
}: {
  workspace?: string | undefined;
  review?: OpenedReview | undefined;
}) {
  return (
    <Screen layout="fixed">
      <ReviewPane workspace={workspace} review={review} />
    </Screen>
  );
}

export function ReviewPane({
  workspace,
  review,
}: {
  workspace?: string | undefined;
  review?: OpenedReview | undefined;
}) {
  const focused = useIsFocused();
  if (!focused) return null;
  const saved = review ? <LinkedReviewPane review={review} /> : undefined;
  return (
    <WorkspaceGate
      title="Review"
      expectedWorkspace={workspace}
      frame="pane"
      unavailable={saved}
      {...(workspace === undefined
        ? {}
        : {
            changed: saved ?? (
              <Empty
                title="Workspace changed"
                description="Another worktree is selected now. Open Review again from the worktree you want."
              />
            ),
          })}
    >
      {(selected) =>
        review ? (
          <CurrentReview
            key={selected.key}
            workspace={selected}
            review={review}
          />
        ) : (
          <PhoneReview key={selected.key} workspace={selected} />
        )
      }
    </WorkspaceGate>
  );
}

function CurrentReview({
  workspace,
  review,
}: {
  workspace: Workspace;
  review: OpenedReview;
}) {
  const publication = useWorkspaceReview(workspace);
  if (
    !AsyncResult.isSuccess(publication.published) ||
    publication.published.waiting
  )
    return (
      <ReviewReadState
        result={publication.published}
        refresh={publication.refreshPublished}
      />
    );
  return workspace.connection.environmentId === review.environmentId &&
    publication.published.value?.reviewId === review.reviewId ? (
    <PhoneReview workspace={workspace} />
  ) : (
    <LinkedReviewPane review={review} />
  );
}

function PhoneReview({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const [comparison, setComparison] = useAtom(
    phoneReviewComparison(workspace.key),
  );
  return (
    <ReviewNavigation
      workspace={workspace}
      comparison={comparison}
      onComparison={setComparison}
      onFile={(path) =>
        router.push({
          pathname: '/review-file',
          params: { ...reviewParams(workspace.key, comparison), path },
        })
      }
    />
  );
}

type ReviewNavigationProps = {
  workspace: Workspace;
  comparison: ReviewComparison;
  onComparison: (comparison: ReviewComparison) => void;
  onFile: (path: string) => void;
};

function ReviewNavigation({
  workspace,
  comparison,
  onComparison,
  onFile,
}: ReviewNavigationProps) {
  const [comparisonWidth, setComparisonWidth] = useState<number>();
  const snapshotRead = useReviewSnapshot(workspace, comparison);
  const { result } = snapshotRead;
  const basesQuery = readBranchBases({
    connection: workspace.connection,
    scope: workspace.scope,
  });
  const bases = useAtomValue(basesQuery);
  const refreshBases = useAtomRefresh(basesQuery);
  const choices = Option.getOrUndefined(AsyncResult.value(bases));
  const reading = useReviewListOffset(
    JSON.stringify([workspace.key, comparison]),
  );
  const base =
    comparison.kind === 'branch'
      ? (comparison.base ??
        (AsyncResult.isSuccess(result) && result.value.kind === 'branch'
          ? result.value.answer.base?.ref
          : undefined) ??
        choices?.defaultRef ??
        undefined)
      : undefined;
  let label = 'Uncommitted';
  if (comparison.kind === 'branch') {
    if (base) label = `Branch · ${refLabel(base)}`;
    else if (AsyncResult.isInitial(result) || result.waiting)
      label = 'Branch · Reading base…';
    else if (AsyncResult.isFailure(result)) label = 'Branch · Base unavailable';
    else label = 'Branch · No base';
  }
  return (
    <Box className="flex-1" surface="background" collapsable={false}>
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="w-full max-w-3xl self-center grow gap-6 p-4"
        contentOffset={{ x: 0, y: reading.initialOffset }}
        onScroll={(event) =>
          reading.onScrollOffset(event.nativeEvent.contentOffset.y)
        }
        scrollEventThrottle={100}
      >
        <PublishedWalkthrough workspace={workspace}>
          {(walkthrough) => <PublishedOverview walkthrough={walkthrough} />}
        </PublishedWalkthrough>
        <ReviewComments
          workspace={workspace}
          snapshot={snapshotRead}
          comparison={comparison}
        />
        <Box gap={2}>
          <Box
            className="flex-row items-center justify-between"
            gap={2}
            onLayout={({ nativeEvent: { layout } }) =>
              setComparisonWidth(layout.width / 2)
            }
          >
            <Text variant="headline" tone="muted" accessibilityRole="header">
              Changed files
            </Text>
            <ComparisonMenu
              comparison={comparison}
              label={label}
              maximumWidth={comparisonWidth}
              base={base}
              bases={choices?.bases ?? []}
              onComparison={onComparison}
            />
          </Box>
          {AsyncResult.isInitial(bases) || bases.waiting ? (
            <Text variant="caption" tone="muted" accessibilityRole="text">
              {choices ? 'Refreshing branches…' : 'Reading branches…'}
            </Text>
          ) : null}
          {AsyncResult.isFailure(bases) ? (
            <Box className="flex-row flex-wrap items-center" gap={2}>
              <Text variant="caption" tone="muted">
                Base branches could not be read.
              </Text>
              <Button
                label="Read branches again"
                variant="tonal"
                size="sm"
                onPress={refreshBases}
              />
            </Box>
          ) : null}
          {!AsyncResult.isFailure(bases) &&
          !bases.waiting &&
          choices?.bases.length === 0 ? (
            <Text variant="caption" tone="muted">
              No base branches available.
            </Text>
          ) : null}
          <ChangedFiles
            workspace={workspace}
            snapshotRead={snapshotRead}
            onFile={onFile}
          />
        </Box>
      </ScrollView>
      <PublishedWalkthrough workspace={workspace} states="hidden">
        {(walkthrough) => <PublishedOverviewBar walkthrough={walkthrough} />}
      </PublishedWalkthrough>
    </Box>
  );
}

function ReviewComments({
  workspace,
  snapshot,
  comparison,
}: {
  workspace: Workspace;
  snapshot: ReturnType<typeof useReviewSnapshot>;
  comparison: ReviewComparison;
}) {
  const router = useRouter();
  const commentsQuery = readCommentThreads({
    connection: workspace.connection,
    scope: workspace.scope,
  });
  const comments = useAtomValue(commentsQuery);
  const refreshComments = useAtomRefresh(commentsQuery);
  const value = AsyncResult.isSuccess(snapshot.result)
    ? snapshot.result.value
    : undefined;
  const anchor = commentsAnchor(
    value?.kind === 'branch' ? value.answer : undefined,
    comparison,
  );
  const open = AsyncResult.isSuccess(comments)
    ? comments.value.filter((thread) => !thread.resolved).length
    : undefined;
  return (
    <Box gap={2}>
      <Card>
        <Item
          title="Comments"
          {...(open === undefined ? {} : { description: `${open} open` })}
          leading={<Icon name="comment" tone="muted" />}
          trailing={<Icon name="chevron" tone="muted" />}
          accessibilityLabel={
            open === undefined ? 'Comments' : `Comments · ${open} open`
          }
          testID="review-comments"
          onPress={() =>
            router.navigate({
              pathname: '/review-comments',
              params: {
                ...reviewParams(workspace.key, comparison),
                ...(anchor ? { anchor: JSON.stringify(anchor) } : {}),
              },
            })
          }
        />
      </Card>
      {AsyncResult.isFailure(comments) ? (
        <ReviewReadState result={comments} refresh={refreshComments} />
      ) : null}
    </Box>
  );
}

function ChangedFiles({
  workspace,
  snapshotRead,
  onFile,
}: {
  workspace: Workspace;
  snapshotRead: ReturnType<typeof useReviewSnapshot>;
  onFile: (path: string) => void;
}) {
  const snapshot = AsyncResult.isSuccess(snapshotRead.result)
    ? snapshotRead.result.value
    : undefined;
  const marks = useReviewMarks(workspace, snapshot);
  if (!snapshot)
    return (
      <ReviewReadState
        result={snapshotRead.result}
        refresh={snapshotRead.refresh}
      />
    );
  if (!AsyncResult.isSuccess(marks.result))
    return <ReviewReadState result={marks.result} refresh={marks.refresh} />;
  const files = reviewFiles(snapshot, marks.result.value);
  const changes = snapshotChangeMarks(snapshotRead.result);
  const branch = snapshot.kind === 'branch' ? snapshot.answer : undefined;
  return (
    <>
      {snapshot.kind === 'branch' ? (
        <Text variant="caption" tone="muted">
          {branch?.base
            ? `${branch.head.branch ?? 'Detached HEAD'} compared with ${branch.base.ref} · ${branch.commits} commits`
            : 'No comparison base is available. Choose a base from the Branch menu.'}
        </Text>
      ) : null}
      {files.length === 0 ? (
        <Empty
          title="No changes"
          description={
            snapshot.kind === 'branch'
              ? 'This branch has no changed files against this base.'
              : 'This worktree has no uncommitted changes.'
          }
        />
      ) : (
        <Card>
          {files.map((file, index) => (
            <Fragment key={file.path}>
              {index > 0 ? <Separator inset="leading" /> : null}
              <Item
                title={file.path}
                titleDecoration={
                  file.reviewStatus === 'reviewed' ? 'line-through' : undefined
                }
                description={file.note}
                leading={
                  <ChangeStatusDot status={changes.files.get(file.path)} />
                }
                accessibilityLabel={`Review ${file.path}, ${changeLabel(changes.files.get(file.path))}, ${file.note}, ${reviewStatusLabel(file.reviewStatus)}`}
                onPress={() => onFile(file.path)}
              />
            </Fragment>
          ))}
        </Card>
      )}
    </>
  );
}

const changeTones: Record<
  ChangeStatus,
  ComponentProps<typeof StatusDot>['tone']
> = {
  added: 'add',
  untracked: 'add',
  modified: 'warning',
  deleted: 'del',
  renamed: 'info',
};

function ChangeStatusDot({ status }: { status: ChangeStatus | undefined }) {
  return (
    <StatusDot
      label={changeLabel(status)}
      tone={status ? changeTones[status] : 'muted'}
    />
  );
}

function changeLabel(status: ChangeStatus | undefined) {
  return status ? changeStatusMarks[status].label : 'Changed';
}

function commentsAnchor(
  branch:
    | {
        readonly base?: { readonly ref: string } | null | undefined;
        readonly head: { readonly oid: string };
      }
    | undefined,
  comparison: ReviewComparison,
) {
  if (branch?.base)
    return changeAnchor({ base: branch.base.ref, tip: branch.head.oid });
  if (comparison.kind === 'worktree') return changeAnchor(undefined);
  return undefined;
}

function reviewStatusLabel(status: ReviewFile['reviewStatus']) {
  if (status === 'stale') return 'Changed since review';
  if (status === 'reviewed') return 'Reviewed';
  return 'Unreviewed';
}
