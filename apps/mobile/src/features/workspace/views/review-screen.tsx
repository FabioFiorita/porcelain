import type { ReviewComparison } from '../../../shared/rules/review-comparison';
import {
  mobileLayout,
  profileMobileScreen,
  startMobileNavigation,
} from '../../../shared/application/mobile-timing';
import { Box } from '../../../components/ui/box';
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
import { Empty } from '../../../components/ui/empty';
import { WorkspaceGate } from '../../projects/index';
import { Item } from '../../../components/ui/item';
import { Card } from '../../../components/ui/card';
import { Icon } from '../../../components/ui/icon';
import { Separator } from '../../../components/ui/separator';
import { Button } from '../../../components/ui/button';
import { Text } from '../../../components/ui/text';
import { StatusDot } from '../../../components/ui/status-dot';
import type { Workspace } from '../../projects/index';

import { useReviewSnapshot, useReviewMarks } from '../queries/review';
import {
  reviewFiles,
  snapshotChangeMarks,
  type ReviewFile,
} from '../rules/comparison';
import { reviewParams } from '../rules/navigation';
import { ReviewReadState } from './read-state';
import { useDraftComments } from './line-comments';
import { Badge } from '../../../components/ui/badge';
import {
  commentCountsByPath,
  openComments,
} from '@porcelain/client/comments/rules';
import {
  changesBesideFile,
  phoneReviewComparison,
  useReviewListOffset,
} from '../store';
import { ListDetail } from '../../../components/ui/list-detail';
import type { ListDetailMode } from '../../../shared/rules/list-detail';
import { ReviewFilePane } from './review-file-screen';
import { ComparisonMenu } from './comparison-menu';

export type ReviewPaneProps = {
  workspace?: string | undefined;
  mode?: ListDetailMode | undefined;
};
export function ReviewPane({ workspace, mode = 'stack' }: ReviewPaneProps) {
  const focused = useIsFocused();
  if (!focused) return null;
  return profileMobileScreen(
    'changes',
    <WorkspaceGate expectedWorkspace={workspace} frame="pane" nested>
      {(selected) => (
        <PhoneReview key={selected.key} workspace={selected} mode={mode} />
      )}
    </WorkspaceGate>,
  );
}

function PhoneReview({
  workspace,
  mode,
}: {
  workspace: Workspace;
  mode: ListDetailMode;
}) {
  const router = useRouter();
  const [comparison, setComparison] = useAtom(
    phoneReviewComparison(workspace.key),
  );
  const [opened, setOpened] = useAtom(changesBesideFile(workspace.key));
  const navigation = (selected: string | undefined) => (
    <ReviewNavigation
      workspace={workspace}
      comparison={comparison}
      selected={selected}
      onComparison={(next) => {
        setComparison(next);
        setOpened(undefined);
      }}
      onFile={(path) =>
        mode === 'beside'
          ? setOpened(path)
          : router.push({
              pathname: '/review-file',
              params: { ...reviewParams(workspace.key, comparison), path },
            })
      }
      onAll={() => {
        startMobileNavigation('all-changes');
        router.push({
          pathname: '/review-changes',
          params: reviewParams(workspace.key, comparison),
        });
      }}
    />
  );
  if (mode === 'stack') return navigation(undefined);
  return (
    <ListDetail
      list={() => navigation(opened)}
      detail={
        opened ? (
          <ReviewFilePane
            key={`${opened}:${JSON.stringify(comparison)}`}
            workspace={workspace}
            path={opened}
            comparison={comparison}
          />
        ) : (
          <Empty title="Select a file" />
        )
      }
    />
  );
}

type ReviewNavigationProps = {
  workspace: Workspace;
  selected?: string | undefined;
  comparison: ReviewComparison;
  onComparison: (comparison: ReviewComparison) => void;
  onFile: (path: string) => void;
  onAll: () => void;
};

function ReviewNavigation({
  workspace,
  selected,
  comparison,
  onComparison,
  onFile,
  onAll,
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
    else if (AsyncResult.isInitial(result) || result.waiting) label = 'Branch';
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
          {AsyncResult.isFailure(bases) && !choices ? (
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
            selected={selected}
            snapshotRead={snapshotRead}
            onFile={onFile}
            onAll={onAll}
          />
        </Box>
      </ScrollView>
    </Box>
  );
}

function ChangedFiles({
  workspace,
  selected,
  snapshotRead,
  onFile,
  onAll,
}: {
  workspace: Workspace;
  selected: string | undefined;
  snapshotRead: ReturnType<typeof useReviewSnapshot>;
  onFile: (path: string) => void;
  onAll: () => void;
}) {
  const snapshot = Option.getOrUndefined(
    AsyncResult.value(snapshotRead.result),
  );
  const marks = useReviewMarks(workspace, snapshot);
  const drafts = useDraftComments(workspace);
  const router = useRouter();
  const counts = commentCountsByPath(drafts);
  const draftCount = openComments(drafts).length;
  if (!snapshot)
    return (
      <ReviewReadState
        result={snapshotRead.result}
        refresh={snapshotRead.refresh}
      />
    );
  const reviewed = Option.getOrUndefined(AsyncResult.value(marks.result));
  if (!reviewed)
    return <ReviewReadState result={marks.result} refresh={marks.refresh} />;
  const files = reviewFiles(snapshot, reviewed);
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
      {draftCount > 0 ? (
        <Card>
          <Item
            title={
              draftCount === 1
                ? '1 draft comment'
                : `${draftCount} draft comments`
            }
            leading={<Icon name="comment" tone="muted" />}
            trailing={<Icon name="chevron" tone="muted" />}
            testID="review-publish-comments"
            accessibilityLabel={`Review and publish ${draftCount} draft ${draftCount === 1 ? 'comment' : 'comments'}`}
            onPress={() =>
              router.push({
                pathname: '/publish-comments',
                params: { workspace: workspace.key },
              })
            }
          />
        </Card>
      ) : null}
      {files.length === 0 ? (
        <Empty title="No changes" />
      ) : (
        <Card>
          <Item
            title="All changes"
            description={`${files.length} ${files.length === 1 ? 'file' : 'files'}`}
            leading={<Icon name="code" tone="muted" />}
            trailing={<Icon name="chevron" tone="muted" />}
            testID="review-all-changes"
            onPress={onAll}
          />
          {files.map((file, index) => (
            <Fragment key={file.path}>
              <Separator inset="leading" />
              <Item
                title={file.path}
                titleDecoration={
                  file.reviewStatus === 'reviewed' ? 'line-through' : undefined
                }
                description={file.note}
                leading={
                  <ChangeStatusDot status={changes.files.get(file.path)} />
                }
                titleTrailing={
                  counts.get(file.path) ? (
                    <Badge
                      variant="secondary"
                      icon="comment"
                      label={String(counts.get(file.path))}
                    />
                  ) : undefined
                }
                accessibilityLabel={`Review ${file.path}, ${changeLabel(changes.files.get(file.path))}, ${file.note}, ${reviewStatusLabel(file.reviewStatus)}${draftLabel(counts.get(file.path))}`}
                selected={file.path === selected}
                onPress={() => onFile(file.path)}
                onLayout={
                  index === 0 ? mobileLayout('changes-first-file') : undefined
                }
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

function draftLabel(count: number | undefined) {
  if (!count) return '';
  return count === 1 ? ', 1 draft comment' : `, ${count} draft comments`;
}

function reviewStatusLabel(status: ReviewFile['reviewStatus']) {
  if (status === 'stale') return 'Changed since review';
  if (status === 'reviewed') return 'Reviewed';
  return 'Unreviewed';
}
