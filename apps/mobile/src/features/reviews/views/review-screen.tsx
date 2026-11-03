import type { ReviewComparison } from '../../../shared/rules/review-comparison';
import { Box } from '../../../components/ui/box';
import { Screen } from '../../../components/ui/screen';
import { useIsFocused, useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { useState, type ComponentProps } from 'react';
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
import { Button } from '../../../components/ui/button';
import { Text } from '../../../components/ui/text';
import { StatusDot } from '../../../components/ui/status-dot';
import type { Workspace } from '../../projects';
import { useReviewSnapshot, useReviewMarks } from '../queries/review';
import {
  reviewFiles,
  snapshotChangeMarks,
  type ReviewFile,
} from '../rules/comparison';
import { reviewParams } from '../rules/navigation';
import { ReviewReadState } from './read-state';
import {
  phoneReviewComparison,
  useReviewListOffset,
  useReviewNavigation,
} from '../store';
import { ComparisonMenu } from './comparison-menu';
import {
  PublishedReview,
  PublishedReviewContinue,
  usePublishedStop,
} from './published-review';

export function ReviewScreen({
  workspace,
}: {
  workspace?: string | undefined;
}) {
  const focused = useIsFocused();
  return focused ? (
    <WorkspaceGate
      title="Review"
      expectedWorkspace={workspace}
      changed={
        <Empty
          title="Workspace changed"
          description="Another worktree is selected now. Open Review again from the worktree you want."
        />
      }
    >
      {(workspace) => (
        <Screen layout="fixed">
          <PhoneReview key={workspace.key} workspace={workspace} />
        </Screen>
      )}
    </WorkspaceGate>
  ) : null;
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
  const { result, refresh } = useReviewSnapshot(workspace, comparison);
  const basesQuery = readBranchBases({
    connection: workspace.connection,
    scope: workspace.scope,
  });
  const bases = useAtomValue(basesQuery);
  const refreshBases = useAtomRefresh(basesQuery);
  const choices = Option.getOrUndefined(AsyncResult.value(bases));
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
      <Box
        className="items-start"
        gap={2}
        paddingX={4}
        paddingY={2}
        divider="bottom"
      >
        <Box
          className="items-start self-stretch"
          onLayout={({ nativeEvent: { layout } }) =>
            setComparisonWidth(layout.width)
          }
        >
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
      </Box>
      {comparison.kind === 'worktree' || AsyncResult.isSuccess(result) ? (
        <ReviewNavigationList
          workspace={workspace}
          snapshotRead={{ result, refresh }}
          comparison={comparison}
          onFile={onFile}
        />
      ) : (
        <ReviewReadState result={result} refresh={refresh} />
      )}
    </Box>
  );
}

function ReviewOverview({
  workspace,
  comparison,
  onFile,
}: {
  workspace: Workspace;
  comparison: ReviewComparison;
  onFile: (path: string) => void;
}) {
  const { result, refresh } = useReviewSnapshot(workspace, comparison);
  if (comparison.kind === 'worktree')
    return (
      <Box gap={3}>
        {!AsyncResult.isSuccess(result) ? (
          <Box gap={2}>
            <Text variant="secondary">
              Changed-file coverage is unavailable.
            </Text>
            <ReviewReadState result={result} refresh={refresh} />
          </Box>
        ) : null}
        <PublishedReview
          workspace={workspace}
          onFile={onFile}
          snapshot={
            AsyncResult.isSuccess(result) &&
            !result.waiting &&
            result.value.kind === 'worktree'
              ? result.value
              : undefined
          }
        />
      </Box>
    );
  if (!AsyncResult.isSuccess(result))
    return <ReviewReadState result={result} refresh={refresh} />;
  const branch =
    result.value.kind === 'branch' ? result.value.answer : undefined;
  return (
    <Text variant="caption" tone="muted">
      {branch?.base
        ? `${branch.head.branch ?? 'Detached HEAD'} compared with ${branch.base.ref} · ${branch.commits} commits`
        : 'No comparison base is available. Choose a base from the Branch menu.'}
    </Text>
  );
}

function ReviewNavigationList({
  workspace,
  snapshotRead,
  comparison,
  onFile,
}: {
  workspace: Workspace;
  snapshotRead: ReturnType<typeof useReviewSnapshot>;
  comparison: ReviewComparison;
  onFile: (path: string) => void;
}) {
  const navigation = useReviewNavigation();
  const router = useRouter();
  const snapshot = AsyncResult.isSuccess(snapshotRead.result)
    ? snapshotRead.result.value
    : undefined;
  const marks = useReviewMarks(workspace, snapshot);
  const commentsQuery = readCommentThreads({
    connection: workspace.connection,
    scope: workspace.scope,
  });
  const comments = useAtomValue(commentsQuery);
  const refreshComments = useAtomRefresh(commentsQuery);
  const branch = snapshot?.kind === 'branch' ? snapshot.answer : undefined;
  const anchor = commentsAnchor(branch, comparison);
  const files =
    snapshot && AsyncResult.isSuccess(marks.result)
      ? reviewFiles(snapshot, marks.result.value)
      : [];
  const changes = snapshotChangeMarks(snapshotRead.result);
  const reading = useReviewListOffset(
    JSON.stringify([workspace.key, comparison]),
  );
  const publishedStop = usePublishedStop(workspace);
  const onStop =
    comparison.kind === 'worktree' &&
    publishedStop !== undefined &&
    publishedStop !== 'briefing';
  let fileList = (
    <ReviewReadState result={marks.result} refresh={marks.refresh} />
  );
  if (!snapshot)
    fileList = (
      <ReviewReadState
        result={snapshotRead.result}
        refresh={snapshotRead.refresh}
      />
    );
  else if (AsyncResult.isSuccess(marks.result))
    fileList = (
      <>
        <Text variant="caption" tone="muted">
          Changed files · {files.length}
        </Text>
        {files.map((file) => (
          <Item
            key={file.path}
            title={file.path}
            titleDecoration={
              file.reviewStatus === 'reviewed' ? 'line-through' : undefined
            }
            description={file.note}
            leading={<ChangeStatusDot status={changes.files.get(file.path)} />}
            accessibilityLabel={`Review ${file.path}, ${changeLabel(changes.files.get(file.path))}, ${file.note}, ${reviewStatusLabel(file.reviewStatus)}`}
            onPress={() => onFile(file.path)}
          />
        ))}
        {files.length === 0 ? (
          <Empty
            title="No changes"
            description={
              snapshot.kind === 'branch'
                ? 'This branch has no changed files against this base.'
                : 'This worktree has no uncommitted changes.'
            }
          />
        ) : null}
      </>
    );
  return (
    <Box className="flex-1">
      <ScrollView
        ref={(view) => navigation.scroll(view)}
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="grow gap-3 p-4"
        contentOffset={{ x: 0, y: reading.initialOffset }}
        onScroll={(event) =>
          reading.onScrollOffset(event.nativeEvent.contentOffset.y)
        }
        scrollEventThrottle={100}
      >
        <ReviewOverview
          workspace={workspace}
          comparison={comparison}
          onFile={onFile}
        />
        {onStop ? null : (
          <>
            <Button
              label={
                AsyncResult.isSuccess(comments)
                  ? `Comments · ${comments.value.filter((thread) => !thread.resolved).length} open`
                  : 'Comments'
              }
              variant="tonal"
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
            {AsyncResult.isFailure(comments) ? (
              <ReviewReadState result={comments} refresh={refreshComments} />
            ) : null}
            {fileList}
          </>
        )}
      </ScrollView>
      {comparison.kind === 'worktree' ? (
        <PublishedReviewContinue
          workspace={workspace}
          onContinue={navigation.scrollToStart}
        />
      ) : null}
    </Box>
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
