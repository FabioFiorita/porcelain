import { useAtomRefresh, useAtomSet, useAtomValue } from '@effect/atom-react';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { AsyncResult } from 'effect/reactivity';
import { readTextFile } from '@porcelain/client/files';
import type { DiffContent } from '@porcelain/client/changes/rules';
import type { ReviewComparison } from '../../../shared/rules/review-comparison';
import { Box } from '../../../components/ui/box';
import { Empty } from '../../../components/ui/empty';
import { Loading } from '../../../components/ui/loading';
import { Screen } from '../../../components/ui/screen';
import { Text } from '../../../components/ui/text';
import { WorkspaceGate, type Workspace } from '../../projects/index';
import { changePageDiffs, useReviewSnapshot } from '../queries/review';
import {
  changeEntries,
  changesSummary,
  type ChangeEntry,
} from '../rules/changes-page';
import { diffBody, diffChunk, sourceBody } from '../rules/diff-page';
import { reviewFileDocumentKey, reviewParams } from '../rules/navigation';
import { chooseReviewFileScope } from '../store';
import {
  DiffPage,
  DiffPagePart,
  type DiffPagePartProps,
  type DiffPageState,
} from './diff-page';
import { ReviewReadState } from './read-state';

export function ChangesPageScreen({
  workspaceKey,
  comparison,
}: {
  workspaceKey?: string | undefined;
  comparison: ReviewComparison;
}) {
  return (
    <Screen layout="fixed">
      <WorkspaceGate
        title="Review"
        expectedWorkspace={workspaceKey ?? ''}
        changed={
          <Empty
            title="Review unavailable"
            description="Return to Changes and select the worktree again."
          />
        }
      >
        {(workspace) => (
          <ChangesPage
            key={`${workspace.key}:${JSON.stringify(comparison)}`}
            workspace={workspace}
            comparison={comparison}
          />
        )}
      </WorkspaceGate>
    </Screen>
  );
}

function ChangesPage({
  workspace,
  comparison,
}: {
  workspace: Workspace;
  comparison: ReviewComparison;
}) {
  const router = useRouter();
  const snapshot = useReviewSnapshot(workspace, comparison);
  const chooseScope = useAtomSet(chooseReviewFileScope);
  if (!AsyncResult.isSuccess(snapshot.result))
    return (
      <ReviewReadState result={snapshot.result} refresh={snapshot.refresh} />
    );
  const files = changeEntries(snapshot.result.value);
  const keys = files.map((file) => file.key);
  const summary = changesSummary(snapshot.result.value, files.length);
  return (
    <FirstDiffs
      workspace={workspace}
      comparison={comparison}
      keys={diffChunk(keys, 0)}
    >
      <DiffPage
        page={JSON.stringify(['changes', workspace.key, comparison])}
        title="All changes"
        subtitle={summary.subtitle}
        files={files}
        header={() => (
          <Box divider="bottom" paddingX={4} paddingY={3}>
            <Text variant="caption" tone="muted">
              {summary.description}
            </Text>
          </Box>
        )}
        empty={
          <Empty
            title="No changes"
            description={
              comparison.kind === 'branch'
                ? 'This branch has no changed files against this base.'
                : 'This worktree has no uncommitted changes.'
            }
          />
        }
        onOpenFile={(file) => {
          if (file.scope)
            chooseScope({
              owner: JSON.stringify([
                workspace.key,
                reviewFileDocumentKey(file.path, comparison),
              ]),
              scope: file.scope,
            });
          router.push({
            pathname: '/review-file',
            params: {
              ...reviewParams(workspace.key, comparison),
              path: file.path,
            },
          });
        }}
        part={(props) => (
          <ChangePart
            {...props}
            workspace={workspace}
            comparison={comparison}
            keys={diffChunk(keys, props.index)}
          />
        )}
      />
    </FirstDiffs>
  );
}

function FirstDiffs({
  workspace,
  comparison,
  keys,
  children,
}: {
  workspace: Workspace;
  comparison: ReviewComparison;
  keys: readonly string[];
  children: ReactNode;
}) {
  const result = useAtomValue(changePageDiffs({ workspace, comparison, keys }));
  const [opened, setOpened] = useState(false);
  const settled =
    keys.length === 0 ||
    AsyncResult.isSuccess(result) ||
    AsyncResult.isFailure(result);
  if (settled && !opened) setOpened(true);
  if (!settled && !opened) return <Loading label="Loading changes…" />;
  return children;
}

type ChangePartProps = DiffPagePartProps<ChangeEntry> & {
  workspace: Workspace;
  comparison: ReviewComparison;
  keys: readonly string[];
};

function ChangePart(props: ChangePartProps) {
  const { read } = props.file;
  if (read.kind === 'untracked') return <UntrackedPart {...props} />;
  if (read.kind === 'notice')
    return (
      <DiffPagePart {...props} state={{ kind: 'notice', title: read.title }} />
    );
  return <ChunkPart {...props} />;
}

function ChunkPart({ workspace, comparison, keys, ...props }: ChangePartProps) {
  const query = changePageDiffs({ workspace, comparison, keys });
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  return (
    <DiffPagePart
      {...props}
      state={chunkState(result, props.file.key, refresh)}
    />
  );
}

function chunkState(
  result: AsyncResult.AsyncResult<
    ReadonlyMap<string, DiffContent | undefined>,
    unknown
  >,
  key: string,
  retry: () => void,
): DiffPageState {
  if (AsyncResult.isFailure(result)) return { kind: 'failed', retry };
  if (!AsyncResult.isSuccess(result)) return { kind: 'loading' };
  const content = result.value.get(key);
  return content
    ? diffBody(content)
    : { kind: 'notice', title: 'Diff unavailable' };
}

function UntrackedPart({ workspace, ...props }: ChangePartProps) {
  const query = readTextFile({
    connection: workspace.connection,
    scope: workspace.scope,
    path: props.file.path,
  });
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  return <DiffPagePart {...props} state={untrackedState(result, refresh)} />;
}

function untrackedState(
  result: AsyncResult.AsyncResult<
    { text: string } | { kind: string; reason: string },
    unknown
  >,
  retry: () => void,
): DiffPageState {
  if (AsyncResult.isFailure(result)) return { kind: 'failed', retry };
  if (!AsyncResult.isSuccess(result)) return { kind: 'loading' };
  if ('kind' in result.value)
    return { kind: 'notice', title: result.value.reason };
  return sourceBody(result.value.text);
}
