import { useAtomRefresh, useAtomSet, useAtomValue } from '@effect/atom-react';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { readTextFile } from '@porcelain/client/files';
import type { ReviewComparison } from '../../../shared/rules/review-comparison';
import { Box } from '../../../components/ui/box';
import { Spinner } from '../../../components/ui/spinner';
import { Empty } from '../../../components/ui/empty';
import { Screen } from '../../../components/ui/screen';
import { Text } from '../../../components/ui/text';
import type { TopBarAction } from '../../../components/ui/top-bar-items';
import { WorkspaceGate, type Workspace } from '../../projects/index';
import { changePageDiffs, useReviewSnapshot } from '../queries/review';
import {
  changeEntries,
  changesSummary,
  walkthroughChangeEntries,
  type ComparedEntry,
} from '../rules/changes-page';
import {
  chunkState,
  diffChunk,
  partState,
  sourceBody,
  type DiffPageState,
} from '../rules/diff-page';
import { reviewFileDocumentKey, reviewParams } from '../rules/navigation';
import { chooseReviewFileScope } from '../store';
import { DiffPage, DiffPagePart, type DiffPagePartProps } from './diff-page';
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
        expectedWorkspace={workspaceKey ?? ''}
        changed={<Empty title="Review unavailable" />}
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
  actions: readonly TopBarAction[];
  empty: { title: string };
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
  const value = Option.getOrUndefined(AsyncResult.value(snapshot.result));
  if (!value)
    return (
      <ReviewReadState result={snapshot.result} refresh={snapshot.refresh} />
    );
  const files = changeEntries(value)
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
      summary={changesSummary(value, files.length)}
    />
  );
}

function WalkthroughChanges(props: ChangesPageProps) {
  const branch = useReviewSnapshot(props.workspace, props.comparison);
  const working = useReviewSnapshot(props.workspace, WORKTREE);
  const branchValue = Option.getOrUndefined(AsyncResult.value(branch.result));
  const workingValue = Option.getOrUndefined(AsyncResult.value(working.result));
  if (!branchValue)
    return <ReviewReadState result={branch.result} refresh={branch.refresh} />;
  if (!workingValue)
    return (
      <ReviewReadState result={working.result} refresh={working.refresh} />
    );
  const files = walkthroughChangeEntries(
    branchValue,
    workingValue,
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
          reading ? <Empty {...reading.empty} /> : <Empty title="No changes" />
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
  if (!settled && !opened) return <Spinner />;
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
  return partState(result, retry, (value) =>
    'kind' in value
      ? { kind: 'notice', title: value.reason }
      : sourceBody(value.text),
  );
}
