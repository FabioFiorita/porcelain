import { useAtomRefresh, useAtomSet, useAtomValue } from '@effect/atom-react';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { AsyncResult } from 'effect/reactivity';
import { readTextFile } from '@porcelain/client/files';
import type { DiffContent } from '@porcelain/client/changes/rules';
import type { ReviewComparison } from '../../../shared/rules/review-comparison';
import { Box } from '../../../components/ui/box';
import { Loading } from '../../../components/ui/loading';
import { Empty } from '../../../components/ui/empty';
import { Screen } from '../../../components/ui/screen';
import { Text } from '../../../components/ui/text';
import type { DocumentAction } from '../../../components/ui/document-header';
import { WorkspaceGate, type Workspace } from '../../projects/index';
import { changePageDiffs, useReviewSnapshot } from '../queries/review';
import {
  changeEntries,
  changesSummary,
  walkthroughChangeEntries,
  type ComparedEntry,
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
  walkthrough,
}: {
  walkthrough?: boolean | undefined;
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
            walkthrough={walkthrough}
          />
        )}
      </WorkspaceGate>
    </Screen>
  );
}

type ChangesReading = {
  page: string;
  title: string;
  only: readonly string[];
  header: ReactNode;
  actions: readonly DocumentAction[];
  empty: { title: string; description: string };
};

type ChangesPageProps = {
  workspace: Workspace;
  comparison: ReviewComparison;
  reading?: ChangesReading | undefined;
  walkthrough?: boolean | undefined;
};

const WORKTREE = { kind: 'worktree' } as const;

export function ChangesPage(props: ChangesPageProps) {
  return props.walkthrough ? (
    <WalkthroughChanges {...props} />
  ) : (
    <ComparisonChanges {...props} />
  );
}

function ComparisonChanges(props: ChangesPageProps) {
  const snapshot = useReviewSnapshot(props.workspace, props.comparison);
  if (!AsyncResult.isSuccess(snapshot.result))
    return (
      <ReviewReadState result={snapshot.result} refresh={snapshot.refresh} />
    );
  const files = changeEntries(snapshot.result.value)
    .filter(
      (file) =>
        props.reading === undefined || props.reading.only.includes(file.path),
    )
    .map((file) => ({
      ...file,
      diffKey: file.key,
      comparison: props.comparison,
    }));
  return (
    <ChangesReader
      {...props}
      files={files}
      summary={changesSummary(snapshot.result.value, files.length)}
    />
  );
}

function WalkthroughChanges(props: ChangesPageProps) {
  const branch = useReviewSnapshot(props.workspace, props.comparison);
  const working = useReviewSnapshot(props.workspace, WORKTREE);
  if (!AsyncResult.isSuccess(branch.result))
    return <ReviewReadState result={branch.result} refresh={branch.refresh} />;
  if (!AsyncResult.isSuccess(working.result))
    return (
      <ReviewReadState result={working.result} refresh={working.refresh} />
    );
  const files = walkthroughChangeEntries(
    branch.result.value,
    working.result.value,
    props.reading?.only,
  );
  const hasBranch = files.some((file) => file.comparison.kind === 'branch');
  const hasWorking = files.some((file) => file.comparison.kind === 'worktree');
  const subtitle = hasBranch ? 'Branch' : 'Uncommitted';
  return (
    <ChangesReader
      {...props}
      files={files}
      summary={{
        subtitle: hasBranch && hasWorking ? 'Branch and uncommitted' : subtitle,
        description: `${files.length} ${files.length === 1 ? 'change' : 'changes'}`,
      }}
    />
  );
}

function ChangesReader({
  workspace,
  comparison,
  reading,
  files,
  summary,
  walkthrough,
}: ChangesPageProps & {
  files: ComparedEntry[];
  summary: { subtitle: string; description: string };
}) {
  const router = useRouter();
  const chooseScope = useAtomSet(chooseReviewFileScope);
  return (
    <FirstDiffs
      workspace={workspace}
      comparison={comparison}
      keys={diffChunk(
        files
          .filter((file) => file.comparison.kind === comparison.kind)
          .map((file) => file.diffKey),
        0,
      )}
    >
      <DiffPage
        page={JSON.stringify([
          'changes',
          workspace.key,
          comparison,
          ...(walkthrough ? ['walkthrough'] : []),
          reading?.page ?? null,
        ])}
        title={reading?.title ?? 'All changes'}
        subtitle={summary.subtitle}
        actions={reading?.actions ?? []}
        files={files}
        header={() =>
          reading?.header ?? (
            <Box divider="bottom" paddingX={4} paddingY={3}>
              <Text variant="caption" tone="muted">
                {summary.description}
              </Text>
            </Box>
          )
        }
        empty={
          reading ? (
            <Empty {...reading.empty} />
          ) : (
            <Empty
              title="No changes"
              description={
                comparison.kind === 'branch'
                  ? 'This branch has no changed files against this base.'
                  : 'This worktree has no uncommitted changes.'
              }
            />
          )
        }
        onOpenFile={(file) => {
          if (file.scope)
            chooseScope({
              owner: JSON.stringify([
                workspace.key,
                reviewFileDocumentKey(file.path, file.comparison),
              ]),
              scope: file.scope,
            });
          router.push({
            pathname: '/review-file',
            params: {
              ...reviewParams(workspace.key, file.comparison),
              path: file.path,
            },
          });
        }}
        part={(props) => {
          const group = files.filter(
            (file) => file.comparison.kind === props.file.comparison.kind,
          );
          return (
            <ChangePart
              {...props}
              workspace={workspace}
              comparison={props.file.comparison}
              keys={diffChunk(
                group.map((file) => file.diffKey),
                group.findIndex((file) => file.key === props.file.key),
              )}
            />
          );
        }}
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

type ChangePartProps = DiffPagePartProps<ComparedEntry> & {
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
      state={chunkState(result, props.file.diffKey, refresh)}
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
