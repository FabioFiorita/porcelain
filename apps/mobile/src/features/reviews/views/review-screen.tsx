import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useAtomValue, useAtomRefresh } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { readBranchBases } from '@porcelain/client/changes';
import { readCommentThreads } from '@porcelain/client/reviews';
import { changeAnchor } from '@porcelain/client/reviews/rules';
import { Empty } from '../../../components/ui/empty';
import { Item } from '../../../components/ui/item';
import { Button } from '../../../components/ui/button';
import { Text } from '../../../components/ui/text';
import { Badge } from '../../../components/ui/badge';
import {
  useReviewWorkspace,
  type ReviewWorkspace,
} from '../adapters/workspace';
import { useReviewSnapshot, useReviewMarks } from '../queries/review';
import {
  reviewFiles,
  type ReviewComparison,
  type ReviewSnapshot,
} from '../rules/comparison';
import { reviewParams } from '../rules/navigation';
import { ReviewReadState } from './read-state';
import { ComparisonMenu } from './comparison-menu';
import { PublishedReview } from './published-review';

export function ReviewScreen() {
  const workspace = useReviewWorkspace();
  return workspace ? (
    <ReviewIndex key={workspace.key} workspace={workspace} />
  ) : (
    <Empty description="Select a worktree to continue." title="Review" />
  );
}

function ReviewIndex({ workspace }: { workspace: ReviewWorkspace }) {
  const [comparison, setComparison] = useState<ReviewComparison>({
    kind: 'worktree',
  });
  const { result, refresh } = useReviewSnapshot(workspace, comparison);
  const bases = useAtomValue(
    readBranchBases({
      connection: workspace.connection,
      scope: workspace.scope,
    }),
  );
  return (
    <View className="flex-1 bg-background" collapsable={false}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1"
        contentContainerClassName="grow gap-3 p-4"
      >
        <View className="flex-row items-center justify-between">
          <ComparisonMenu
            comparison={comparison}
            bases={AsyncResult.isSuccess(bases) ? bases.value.bases : []}
            onComparison={setComparison}
          />
          <Button
            label="Refresh"
            variant="ghost"
            pending={result.waiting}
            onPress={refresh}
          />
        </View>
        {AsyncResult.isSuccess(result) ? (
          <ReviewList
            workspace={workspace}
            snapshot={result.value}
            comparison={comparison}
          />
        ) : (
          <ReviewReadState result={result} refresh={refresh} />
        )}
      </ScrollView>
    </View>
  );
}

function ReviewList({
  workspace,
  snapshot,
  comparison,
}: {
  workspace: ReviewWorkspace;
  snapshot: ReviewSnapshot;
  comparison: ReviewComparison;
}) {
  const router = useRouter();
  const marks = useReviewMarks(workspace, snapshot);
  const commentsQuery = readCommentThreads({
    connection: workspace.connection,
    scope: workspace.scope,
  });
  const comments = useAtomValue(commentsQuery);
  const refreshComments = useAtomRefresh(commentsQuery);
  const openFile = (path: string) =>
    router.push({
      pathname: '/review-file',
      params: { ...reviewParams(workspace.key, comparison), path },
    });
  const branch = snapshot.kind === 'branch' ? snapshot.answer : undefined;
  const anchor = branch?.base
    ? changeAnchor({ base: branch.base.ref, tip: branch.head.oid })
    : comparison.kind === 'worktree'
      ? changeAnchor(undefined)
      : undefined;
  return (
    <View className="gap-3">
      {snapshot.kind === 'worktree' ? (
        <PublishedReview workspace={workspace} onFile={openFile} />
      ) : (
        <Text variant="caption" tone="muted">
          {branch?.base
            ? `${branch.head.branch ?? 'Detached HEAD'} compared with ${branch.base.ref} · ${branch.commits} commits`
            : 'No comparison base is available. Choose a base from the Branch menu.'}
        </Text>
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
            Changed files · {reviewFiles(snapshot, marks.result.value).length}
          </Text>
          {reviewFiles(snapshot, marks.result.value).map((file) => (
            <Item
              key={file.path}
              title={file.path}
              description={file.note}
              accessibilityLabel={`Review ${file.path}`}
              trailing={
                <Badge
                  label={
                    file.reviewStatus === 'stale'
                      ? 'Changed since review'
                      : file.reviewStatus === 'reviewed'
                        ? 'Reviewed'
                        : 'Unreviewed'
                  }
                  variant="secondary"
                />
              }
              onPress={() => openFile(file.path)}
            />
          ))}
          {reviewFiles(snapshot, marks.result.value).length === 0 ? (
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
    </View>
  );
}
