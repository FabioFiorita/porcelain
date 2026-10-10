import { Box } from '../../../components/ui/box';
import { Stack, useLocalSearchParams } from 'expo-router';
import { AsyncResult } from 'effect/reactivity';
import type { CommitFile } from '@porcelain/client/history/rules';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { FileHeader } from '../../../components/ui/file-header';
import { DiffView } from '../../../components/ui/diff-view';
import { patchLines } from '../../../shared/rules/patch-lines';
import { useSelectedWorktree } from '../../projects';
import { usePreferences } from '../../preferences';
import {
  useCommit,
  useCommitPatch,
  type HistorySelection,
} from '../queries/history';
import { commitPath, commitPaths, patchUnavailable } from '../rules';

export function CommitDiffScreen() {
  const {
    oid,
    workspace,
    path,
    parent: requestedParent,
  } = useLocalSearchParams<{
    oid: string;
    workspace?: string;
    path: string;
    parent?: string;
  }>();
  const parent = Number(requestedParent ?? 1);
  const current = useSelectedWorktree();
  return current &&
    (!workspace || current.key === workspace) &&
    Number.isInteger(parent) &&
    parent > 0 ? (
    <CommitFileDiff
      key={`${current.key}:${oid}:${parent}:${path}`}
      selection={current}
      oid={oid}
      parent={parent}
      path={path}
    />
  ) : (
    <Empty
      title="Workspace changed"
      description="Return to History to open a commit in the selected worktree."
    />
  );
}

function CommitFileDiff({
  selection,
  oid,
  parent,
  path,
}: {
  selection: HistorySelection;
  oid: string;
  parent: number;
  path: string;
}) {
  const commit = useCommit(selection, oid, parent);
  if (AsyncResult.isFailure(commit.result))
    return (
      <ErrorState
        message="Couldn't load commit"
        retry={{ label: 'Retry', onPress: commit.retry }}
      />
    );
  if (!commit.value) return <Loading label="Loading commit…" />;
  const file = commit.value.files.find(
    (candidate) => commitPath(candidate) === path,
  );
  return (
    <Box className="flex-1" surface="background">
      <Stack.Screen options={{ title: path.split('/').at(-1) ?? 'Diff' }} />
      {file ? (
        <FilePatch
          selection={selection}
          oid={oid}
          parent={parent}
          file={file}
        />
      ) : (
        <Empty
          title="File unavailable"
          description="This file is not part of the commit comparison."
        />
      )}
    </Box>
  );
}

function FilePatch({
  selection,
  oid,
  parent,
  file,
}: {
  selection: HistorySelection;
  oid: string;
  parent: number;
  file: CommitFile;
}) {
  const { preferences } = usePreferences();
  const patch = useCommitPatch(selection, oid, parent, commitPaths(file));
  const content = patch.value;
  const parsed =
    content?.kind === 'text' ? patchLines(content.patch) : undefined;
  const unavailable = (() => {
    if (file.oldMode === '160000' || file.newMode === '160000') {
      return 'Submodule change';
    }
    if (content) {
      return patchUnavailable(content);
    }
    return undefined;
  })();
  return (
    <>
      <FileHeader path={commitPath(file)} status={file.status} />
      {(() => {
        if (AsyncResult.isFailure(patch.result)) {
          return (
            <ErrorState
              message="Couldn't load diff"
              retry={{ label: 'Retry', onPress: patch.retry }}
            />
          );
        }
        if (!content) {
          return patch.result.waiting || AsyncResult.isInitial(patch.result) ? (
            <Loading label="Loading diff…" />
          ) : (
            <Empty
              title="Diff unavailable"
              description="The server returned no patch for this file."
            />
          );
        }
        if (unavailable) {
          return (
            <Empty
              title={unavailable}
              description="This file change has no code preview."
            />
          );
        }
        if (parsed?.kind === 'invalid') {
          return (
            <ErrorState
              message="The patch could not be parsed"
              retry={{ label: 'Retry', onPress: patch.retry }}
            />
          );
        }
        if (parsed?.kind === 'text') {
          return (
            <DiffView lines={parsed.lines} wrap={preferences.wrapLongLines} />
          );
        }
        return (
          <Empty
            title="No code change"
            description="This comparison has no changed lines."
          />
        );
      })()}
    </>
  );
}
