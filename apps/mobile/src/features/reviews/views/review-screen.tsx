import type { ReviewComparison } from '../../../shared/rules/review-comparison';
import { Box } from '../../../components/ui/box';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { readBranchBases } from '@porcelain/client/changes';
import { readCommentThreads } from '@porcelain/client/reviews';
import { changeAnchor } from '@porcelain/client/reviews/rules';
import { Empty } from '../../../components/ui/empty';
import { WorkspaceGate } from '../../projects';
import { Item } from '../../../components/ui/item';
import { Button } from '../../../components/ui/button';
import { Text } from '../../../components/ui/text';
import { Badge } from '../../../components/ui/badge';
import { Icon } from '../../../components/ui/icon';
import { FileIcon } from '../../../components/ui/file-icon';
import type { Workspace } from '../../projects';
import { useReviewSnapshot, useReviewMarks } from '../queries/review';
import {
  reviewFiles,
  type ReviewFile,
  type ReviewSnapshot,
} from '../rules/comparison';
import { reviewParams } from '../rules/navigation';
import { ReviewReadState } from './read-state';
import { ComparisonMenu } from './comparison-menu';
import { PublishedReview } from './published-review';

export function ReviewScreen() {
  return (
    <WorkspaceGate title="Review">
      {(workspace) => <PhoneReview key={workspace.key} workspace={workspace} />}
    </WorkspaceGate>
  );
}

function PhoneReview({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const [comparison, setComparison] = useState<ReviewComparison>({
    kind: 'worktree',
  });
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

export function ReviewNavigation({
  workspace,
  comparison,
  onComparison,
  onFile,
  onOverview,
  selectedPath,
  overviewSelected = false,
  inlineOverview = false,
  embedded = false,
}: {
  workspace: Workspace;
  comparison: ReviewComparison;
  onComparison: (comparison: ReviewComparison) => void;
  onFile: (path: string) => void;
  onOverview: () => void;
  selectedPath?: string | undefined;
  overviewSelected?: boolean;
  inlineOverview?: boolean;
  embedded?: boolean;
}) {
  const { result, refresh } = useReviewSnapshot(workspace, comparison);
  const bases = useAtomValue(
    readBranchBases({
      connection: workspace.connection,
      scope: workspace.scope,
    }),
  );
  return (
    <Box className="flex-1" surface="background" collapsable={false}>
      <Box
        className="flex-row items-center justify-between"
        paddingX={4}
        paddingY={2}
        divider="bottom"
      >
        <ComparisonMenu
          comparison={comparison}
          bases={AsyncResult.isSuccess(bases) ? bases.value.bases : []}
          onComparison={onComparison}
        />
        {!embedded ? (
          <Button
            label="Refresh"
            variant="ghost"
            pending={result.waiting}
            onPress={refresh}
          />
        ) : null}
      </Box>
      {AsyncResult.isSuccess(result) ? (
        <ReviewNavigationList
          workspace={workspace}
          snapshot={result.value}
          comparison={comparison}
          onFile={onFile}
          onOverview={onOverview}
          selectedPath={selectedPath}
          overviewSelected={overviewSelected}
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
  empty,
}: {
  workspace: Workspace;
  comparison: ReviewComparison;
  onFile: (path: string) => void;
  empty?: boolean;
}) {
  const { result, refresh } = useReviewSnapshot(workspace, comparison);
  if (comparison.kind === 'worktree')
    return (
      <PublishedReview
        workspace={workspace}
        onFile={onFile}
        empty={
          empty ? (
            <Empty
              title="No agent review"
              description="Choose a changed file to review its diff. Published agent explanations will appear here."
            />
          ) : undefined
        }
      />
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
  selectedPath,
  overviewSelected,
  inlineOverview,
}: {
  workspace: Workspace;
  snapshot: ReviewSnapshot;
  comparison: ReviewComparison;
  onFile: (path: string) => void;
  onOverview: () => void;
  selectedPath: string | undefined;
  overviewSelected: boolean;
  inlineOverview: boolean;
}) {
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
  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="grow gap-3 p-4"
    >
      {inlineOverview ? (
        <ReviewOverview
          workspace={workspace}
          comparison={comparison}
          onFile={onFile}
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
          selected={overviewSelected}
          onPress={onOverview}
        />
      )}
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
              title={
                inlineOverview
                  ? file.path
                  : (file.path.split('/').at(-1) ?? file.path)
              }
              description={
                inlineOverview
                  ? file.note
                  : `${file.path} · ${file.note} · ${reviewStatusLabel(file.reviewStatus)}`
              }
              leading={inlineOverview ? undefined : <FileIcon />}
              size={inlineOverview ? 'default' : 'sm'}
              selected={!inlineOverview && selectedPath === file.path}
              accessibilityLabel={`Review ${file.path}`}
              trailing={
                inlineOverview ? (
                  <Badge
                    label={reviewStatusLabel(file.reviewStatus)}
                    variant="secondary"
                  />
                ) : undefined
              }
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
    </ScrollView>
  );
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
