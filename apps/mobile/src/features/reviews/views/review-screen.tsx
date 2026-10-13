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
import { DocumentTabs } from '../../../components/ui/document-tabs';
import { WorkspacePanes } from '../../../components/ui/workspace-panes';
import { isTablet } from '../../../shared/navigation/is-tablet';
import {
  emptyDocuments,
  activateDocument,
  openDocument,
  type DocumentTabsState,
} from '../../../shared/rules/document-tabs';
import type { Workspace } from '../../projects';
import { useReviewSnapshot, useReviewMarks } from '../queries/review';
import {
  reviewFiles,
  type ReviewComparison,
  type ReviewFile,
  type ReviewSnapshot,
} from '../rules/comparison';
import { reviewParams } from '../rules/navigation';
import { ReviewReadState } from './read-state';
import { ComparisonMenu } from './comparison-menu';
import { PublishedReview } from './published-review';
import { ReviewFileContent } from './review-file-screen';

export function ReviewScreen() {
  return (
    <WorkspaceGate title="Review">
      {(workspace) => <ReviewIndex key={workspace.key} workspace={workspace} />}
    </WorkspaceGate>
  );
}

function ReviewIndex({ workspace }: { workspace: Workspace }) {
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
          onComparison={setComparison}
        />
        <Button
          label="Refresh"
          variant="ghost"
          pending={result.waiting}
          onPress={refresh}
        />
      </Box>
      {AsyncResult.isSuccess(result) ? (
        <ReviewList
          key={JSON.stringify(comparison)}
          workspace={workspace}
          snapshot={result.value}
          comparison={comparison}
        />
      ) : (
        <ReviewReadState result={result} refresh={refresh} />
      )}
    </Box>
  );
}

type ReviewDocument = {
  key: string;
  title: string;
  label?: string;
  closable: boolean;
  path?: string;
};

function ReviewList({
  workspace,
  snapshot,
  comparison,
}: {
  workspace: Workspace;
  snapshot: ReviewSnapshot;
  comparison: ReviewComparison;
}) {
  const [documents, setDocuments] = useState<DocumentTabsState<ReviewDocument>>(
    () =>
      openDocument(emptyDocuments<ReviewDocument>(), {
        key: 'overview',
        title: 'Overview',
        closable: false,
      }),
  );
  const selected = documents.tabs.find((tab) => tab.key === documents.active);
  const selectedPath = selected?.path;
  const router = useRouter();
  const marks = useReviewMarks(workspace, snapshot);
  const commentsQuery = readCommentThreads({
    connection: workspace.connection,
    scope: workspace.scope,
  });
  const comments = useAtomValue(commentsQuery);
  const refreshComments = useAtomRefresh(commentsQuery);
  const openFile = (path: string, showContent?: () => void) => {
    if (isTablet) {
      setDocuments((current) =>
        openDocument(current, {
          key: `file:${path}`,
          title: path.split('/').at(-1) ?? path,
          label: path,
          closable: true,
          path,
        }),
      );
      showContent?.();
    } else
      router.push({
        pathname: '/review-file',
        params: { ...reviewParams(workspace.key, comparison), path },
      });
  };
  const branch = snapshot.kind === 'branch' ? snapshot.answer : undefined;
  const anchor = commentsAnchor(branch, comparison);
  const files = AsyncResult.isSuccess(marks.result)
    ? reviewFiles(snapshot, marks.result.value)
    : [];
  const overview =
    snapshot.kind === 'worktree' ? (
      <PublishedReview
        workspace={workspace}
        onFile={(path) => openFile(path)}
        empty={
          isTablet ? (
            <Empty
              title="No agent review"
              description="Choose a changed file to review its diff. Published agent explanations will appear here."
            />
          ) : undefined
        }
      />
    ) : (
      <Text variant="caption" tone="muted">
        {branch?.base
          ? `${branch.head.branch ?? 'Detached HEAD'} compared with ${branch.base.ref} · ${branch.commits} commits`
          : 'No comparison base is available. Choose a base from the Branch menu.'}
      </Text>
    );
  const navigation = (showContent?: () => void) => (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="grow gap-3 p-4"
    >
      {isTablet ? (
        <Item
          title="Overview"
          description={
            snapshot.kind === 'worktree'
              ? 'Agent explanation and proof'
              : 'Branch comparison'
          }
          leading={<Icon name="review" />}
          selected={selectedPath === undefined}
          onPress={() => {
            setDocuments((current) => activateDocument(current, 'overview'));
            showContent?.();
          }}
        />
      ) : (
        overview
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
                isTablet
                  ? (file.path.split('/').at(-1) ?? file.path)
                  : file.path
              }
              description={
                isTablet
                  ? `${file.path} · ${file.note} · ${reviewStatusLabel(file.reviewStatus)}`
                  : file.note
              }
              leading={isTablet ? <FileIcon /> : undefined}
              size={isTablet ? 'sm' : 'default'}
              selected={isTablet && selectedPath === file.path}
              accessibilityLabel={`Review ${file.path}`}
              trailing={
                isTablet ? undefined : (
                  <Badge
                    label={reviewStatusLabel(file.reviewStatus)}
                    variant="secondary"
                  />
                )
              }
              onPress={() => openFile(file.path, showContent)}
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
  return isTablet ? (
    <WorkspacePanes
      navigation={navigation}
      navigationLabel="Changed files"
      hasSelection={documents.active !== null}
    >
      <DocumentTabs documents={documents} onChange={setDocuments} />
      {selectedPath ? (
        <ReviewFileContent
          key={`${workspace.key}:${selectedPath}:${JSON.stringify(comparison)}`}
          workspace={workspace}
          path={selectedPath}
          comparison={comparison}
        />
      ) : (
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="grow gap-3 p-4"
        >
          {overview}
        </ScrollView>
      )}
    </WorkspacePanes>
  ) : (
    navigation()
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
