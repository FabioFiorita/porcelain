import type { ReviewComparison } from '../../../shared/rules/review-comparison';
import type { ReviewPanelSelection } from '../../../shared/rules/workspace-session';
import { Box } from '../../../components/ui/box';
import { useIsFocused, useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { useState, type ComponentProps } from 'react';
import { useAtom, useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readBranchBases } from '@porcelain/client/changes';
import {
  branchChangeMarks,
  changeStatusMarks,
  worktreeChangeMarks,
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
import { Icon } from '../../../components/ui/icon';
import type { Workspace } from '../../projects';
import { useReviewSnapshot, useReviewMarks } from '../queries/review';
import {
  reviewFiles,
  type ReviewFile,
  type ReviewSnapshot,
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

export function ReviewScreen() {
  const focused = useIsFocused();
  return focused ? (
    <WorkspaceGate title="Review">
      {(workspace) => <PhoneReview key={workspace.key} workspace={workspace} />}
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
      inlineOverview
      onFile={(path) =>
        router.push({
          pathname: '/review-file',
          params: { ...reviewParams(workspace.key, comparison), path },
        })
      }
      onOverview={() => undefined}
    />
  );
}

type ReviewNavigationProps = {
  workspace: Workspace;
  comparison: ReviewComparison;
  onComparison: (comparison: ReviewComparison) => void;
  onFile: (path: string) => void;
  onOverview: () => void;
  selection?: ReviewPanelSelection | undefined;
  inlineOverview?: boolean;
};

export function ReviewNavigation({
  active = true,
  ...props
}: ReviewNavigationProps & { active?: boolean }) {
  return active ? <ReviewNavigationContent {...props} /> : null;
}

function ReviewNavigationContent({
  workspace,
  comparison,
  onComparison,
  onFile,
  onOverview,
  selection,
  inlineOverview = false,
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
              variant="outline"
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
      {AsyncResult.isSuccess(result) ? (
        <ReviewNavigationList
          workspace={workspace}
          snapshot={result.value}
          comparison={comparison}
          onFile={onFile}
          onOverview={onOverview}
          selection={selection}
          inlineOverview={inlineOverview}
        />
      ) : (
        <ReviewReadState result={result} refresh={refresh} />
      )}
    </Box>
  );
}

export function ReviewOverview({
  workspace,
  comparison,
  onFile,
  docked = false,
}: {
  workspace: Workspace;
  comparison: ReviewComparison;
  onFile: (path: string) => void;
  docked?: boolean;
}) {
  const { result, refresh } = useReviewSnapshot(workspace, comparison);
  if (comparison.kind === 'worktree')
    return (
      <Box gap={3}>
        {!AsyncResult.isSuccess(result) ? (
          <Box gap={2}>
            <Text variant="ui">Changed-file coverage is unavailable.</Text>
            <ReviewReadState result={result} refresh={refresh} />
          </Box>
        ) : null}
        <PublishedReview
          workspace={workspace}
          onFile={onFile}
          docked={docked}
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
  snapshot,
  comparison,
  onFile,
  onOverview,
  selection,
  inlineOverview,
}: {
  workspace: Workspace;
  snapshot: ReviewSnapshot;
  comparison: ReviewComparison;
  onFile: (path: string) => void;
  onOverview: () => void;
  selection: ReviewPanelSelection | undefined;
  inlineOverview: boolean;
}) {
  const navigation = useReviewNavigation();
  const router = useRouter();
  const marks = useReviewMarks(workspace, snapshot);
  const commentsQuery = readCommentThreads({
    connection: workspace.connection,
    scope: workspace.scope,
  });
  const comments = useAtomValue(commentsQuery);
  const refreshComments = useAtomRefresh(commentsQuery);
  const branch = snapshot.kind === 'branch' ? snapshot.answer : undefined;
  const anchor = commentsAnchor(branch, comparison);
  const files = AsyncResult.isSuccess(marks.result)
    ? reviewFiles(snapshot, marks.result.value)
    : [];
  const changes =
    snapshot.kind === 'worktree'
      ? worktreeChangeMarks(snapshot.answer.changes)
      : branchChangeMarks(snapshot.answer.files);
  const reading = useReviewListOffset(
    JSON.stringify([workspace.key, comparison]),
  );
  const publishedStop = usePublishedStop(
    workspace,
    snapshot.kind === 'worktree'
      ? snapshot.answer.changes.map((file) => file.path)
      : [],
  );
  const onStop =
    inlineOverview &&
    comparison.kind === 'worktree' &&
    publishedStop !== undefined &&
    publishedStop !== 'briefing';
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
        {inlineOverview ? (
          <ReviewOverview
            workspace={workspace}
            comparison={comparison}
            onFile={onFile}
            docked
          />
        ) : (
          <Item
            title="Overview"
            description={
              snapshot.kind === 'worktree'
                ? 'Agent explanation and proof'
                : 'Branch comparison'
            }
            leading={<Icon name="review" />}
            selected={selection?.kind === 'overview'}
            onPress={onOverview}
          />
        )}
        {onStop ? null : (
          <>
            <Button
              label={
                AsyncResult.isSuccess(comments)
                  ? `Comments · ${comments.value.filter((thread) => !thread.resolved).length} open`
                  : 'Comments'
              }
              variant="outline"
              onPress={() =>
                router.push({
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
            {AsyncResult.isSuccess(marks.result) ? (
              <>
                <Text variant="caption" tone="muted">
                  Changed files · {files.length}
                </Text>
                {files.map((file) => (
                  <Item
                    key={file.path}
                    {...(!inlineOverview
                      ? {
                          titleNumberOfLines: 1,
                          descriptionNumberOfLines: 1,
                        }
                      : {})}
                    title={
                      inlineOverview
                        ? file.path
                        : (file.path.split('/').at(-1) ?? file.path)
                    }
                    titleDecoration={
                      file.reviewStatus === 'reviewed'
                        ? 'line-through'
                        : undefined
                    }
                    description={
                      inlineOverview
                        ? file.note
                        : `${file.path} · ${file.note} · ${reviewStatusLabel(file.reviewStatus)}`
                    }
                    leading={
                      <ChangeStatusDot status={changes.files.get(file.path)} />
                    }
                    size={inlineOverview ? 'default' : 'sm'}
                    selected={
                      !inlineOverview &&
                      selection?.kind === 'file' &&
                      selection.path === file.path
                    }
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
            ) : (
              <ReviewReadState result={marks.result} refresh={marks.refresh} />
            )}
          </>
        )}
      </ScrollView>
      {inlineOverview && snapshot.kind === 'worktree' ? (
        <PublishedReviewContinue
          workspace={workspace}
          snapshot={snapshot}
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
