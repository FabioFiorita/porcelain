import type { ReactNode } from 'react';
import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { historyPlace, focusCommitFile } from '@porcelain/client/history';
import { isSubmoduleChange } from '@porcelain/client/changes/rules';
import { Box } from '../../../components/ui/box';
import { Empty } from '../../../components/ui/empty';
import { Loading } from '../../../components/ui/loading';
import { Text } from '../../../components/ui/text';
import { Badge } from '../../../components/ui/badge';
import {
  DiffPage,
  DiffPagePart,
  diffBody,
  diffChunk,
  type DiffPageFile,
  type DiffPagePartProps,
  type DiffPageState,
} from '../../workspace/index';
import {
  useCommit,
  useCommitPatch,
  type HistorySelection,
} from '../queries/history';
import {
  commitPath,
  commitPaths,
  shortOid,
  type CommitFile,
} from '@porcelain/client/history/rules';
import { CommitReadState } from './commit-state';
import { CommitParentMenu } from './commit-parent-menu';
import { commitRefLabel } from '../../../shared/rules/commit-ref';

type CommitPageProps = {
  selection: HistorySelection;
  oid: string;
  parent: number;
  onParentChange: (parent: number) => void;
  onOpenFile: (path: string) => void;
  selectedPath?: string | undefined;
};

type CommitPageFile = DiffPageFile & { change: CommitFile };

export function CommitPage(props: CommitPageProps) {
  const resetId = useAtomValue(
    historyPlace({
      ...props.selection,
      kind: 'commit',
      oid: props.oid,
      parent: props.parent,
    }),
    (place) => place.resetId,
  );
  return <CommitPageView key={resetId} {...props} />;
}

function CommitPageView({
  selection,
  oid,
  parent,
  onParentChange,
  onOpenFile,
  selectedPath,
}: CommitPageProps) {
  const commit = useCommit(selection, oid, parent);
  const [place, setPlace] = useAtom(
    historyPlace({ ...selection, kind: 'commit', oid, parent }),
  );
  const focusedPath = place.selected ?? selectedPath;
  const focusFile = useAtomSet(focusCommitFile(selection));
  return (
    <CommitReadState commit={commit}>
      {(value) => {
        const files = value.files.map((change): CommitPageFile => ({
          key: commitPaths(change).join('\0'),
          path: commitPath(change),
          details: [
            change.status === 'renamed'
              ? `renamed from ${change.oldPath ?? ''}`
              : change.status,
          ],
          change,
        }));
        const chunks = files.map((file) => commitPaths(file.change));
        return (
          <FirstDiffs
            selection={selection}
            oid={oid}
            parent={parent}
            chunk={diffChunk(chunks, 0)}
          >
            <DiffPage
              page={JSON.stringify(['commit', oid, parent])}
              title={shortOid(oid)}
              subtitle={`${files.length} file${files.length === 1 ? '' : 's'} changed`}
              files={files}
              initialFile={
                files.find(
                  (file) =>
                    focusedPath !== undefined &&
                    commitPaths(file.change).includes(focusedPath),
                )?.key
              }
              empty={
                <Empty
                  title="No changed files"
                  description="This commit has no file changes against this comparison."
                />
              }
              onFocused={() =>
                setPlace((current) => ({ ...current, selected: undefined }))
              }
              onOpenFile={(file) => onOpenFile(file.path)}
              part={(props: DiffPagePartProps<CommitPageFile>) => (
                <CommitFilePart
                  {...props}
                  selection={selection}
                  oid={oid}
                  parent={parent}
                  chunk={diffChunk(chunks, props.index)}
                />
              )}
              header={(current) => (
                <Box gap={3} divider="bottom" padding={4}>
                  <Text variant="title" selectable>
                    {value.commit.subject}
                  </Text>
                  {value.commit.body ? (
                    <Text variant="secondary" tone="muted" selectable>
                      {value.commit.body}
                    </Text>
                  ) : null}
                  {value.commit.subjectTruncated ||
                  value.commit.bodyTruncated ? (
                    <Text variant="caption" tone="muted">
                      Commit message truncated
                    </Text>
                  ) : null}
                  <Text variant="caption" tone="muted">
                    {value.commit.author.name} ·{' '}
                    {new Date(value.commit.author.timestamp).toLocaleString()}
                  </Text>
                  <Text variant="code" tone="muted" selectable>
                    {oid}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {value.comparison.kind === 'parent'
                      ? `Against ${shortOid(value.comparison.baseOid)} · Parent ${value.comparison.parentNumber}`
                      : 'Root commit'}
                  </Text>
                  {value.commit.parentOids.length > 1 ? (
                    <CommitParentMenu
                      parentOids={value.commit.parentOids}
                      parent={parent}
                      onSelect={(nextParent) => {
                        if (nextParent === parent) return;
                        const path = current?.path ?? focusedPath;
                        if (path !== undefined)
                          focusFile({ oid, parent: nextParent, path });
                        onParentChange(nextParent);
                      }}
                    />
                  ) : null}
                  {value.commit.refs.length > 0 ? (
                    <Box className="flex-row flex-wrap" gap={1}>
                      {value.commit.refs.map((ref) => (
                        <Badge
                          key={`${ref.kind}:${ref.name}`}
                          label={commitRefLabel(ref)}
                          variant="secondary"
                        />
                      ))}
                    </Box>
                  ) : null}
                  <Text
                    variant="secondary"
                    weight="medium"
                  >{`${value.files.length} file${value.files.length === 1 ? '' : 's'} changed`}</Text>
                  {commit.result.waiting ? (
                    <Loading label="Loading comparison…" />
                  ) : null}
                </Box>
              )}
            />
          </FirstDiffs>
        );
      }}
    </CommitReadState>
  );
}

function FirstDiffs({
  selection,
  oid,
  parent,
  chunk,
  children,
}: {
  selection: HistorySelection;
  oid: string;
  parent: number;
  chunk: readonly (readonly string[])[];
  children: ReactNode;
}) {
  const first = chunk[0];
  const patch = useCommitPatch(selection, oid, parent, first ?? [], chunk);
  if (first && !patch.value && !AsyncResult.isFailure(patch.result))
    return <Loading label="Loading commit…" />;
  return children;
}

function CommitFilePart({
  selection,
  oid,
  parent,
  chunk,
  ...props
}: DiffPagePartProps<CommitPageFile> & {
  selection: HistorySelection;
  oid: string;
  parent: number;
  chunk: readonly (readonly string[])[];
}) {
  const paths = commitPaths(props.file.change);
  const patch = useCommitPatch(selection, oid, parent, paths, chunk);
  return (
    <DiffPagePart
      {...props}
      state={commitFileState(props.file.change, patch)}
    />
  );
}

function commitFileState(
  change: CommitFile,
  patch: ReturnType<typeof useCommitPatch>,
): DiffPageState {
  if (isSubmoduleChange(change))
    return { kind: 'notice', title: 'Submodule change' };
  if (patch.value) return diffBody(patch.value);
  if (AsyncResult.isFailure(patch.result))
    return { kind: 'failed', retry: patch.retry };
  return { kind: 'loading' };
}
