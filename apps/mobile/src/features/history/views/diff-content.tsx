import { CommitState } from './commit-state';
import { Box } from '../../../components/ui/box';
import { AsyncResult } from 'effect/reactivity';
import type { CommitFile } from '@porcelain/client/history/rules';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { FileHeader } from '../../../components/ui/file-header';
import { DiffView } from '../../../components/ui/diff-view';
import { patchLines } from '@porcelain/client/changes/rules';
import { usePreferences } from '../../preferences';
import {
  useCommit,
  useCommitPatch,
  type HistorySelection,
} from '../queries/history';
import {
  diffUnavailableReason,
  isSubmoduleChange,
} from '@porcelain/client/changes/rules';
import { commitPath, commitPaths } from '@porcelain/client/history/rules';

export function DiffContent({
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
  if (AsyncResult.isFailure(commit.result) || !commit.value)
    return (
      <CommitState
        failed={AsyncResult.isFailure(commit.result)}
        retry={commit.retry}
      />
    );

  const file = commit.value.files.find(
    (candidate) => commitPath(candidate) === path,
  );
  return (
    <Box className="flex-1" surface="background">
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
  return (
    <>
      <FileHeader path={commitPath(file)} status={file.status} />
      <FilePatchContent
        selection={selection}
        oid={oid}
        parent={parent}
        file={file}
      />
    </>
  );
}

function FilePatchContent({
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
  const failed = AsyncResult.isFailure(patch.result);
  const submodule = isSubmoduleChange(file);
  const unavailable = diffUnavailableReason(file, content, failed);
  if (failed && !submodule)
    return (
      <ErrorState
        message="Couldn't load diff"
        retry={{ label: 'Retry', onPress: patch.retry }}
      />
    );
  if (!content && !submodule)
    return patch.result.waiting || AsyncResult.isInitial(patch.result) ? (
      <Loading label="Loading diff…" />
    ) : (
      <Empty
        title="Diff unavailable"
        description="The server returned no patch for this file."
      />
    );
  if (unavailable)
    return (
      <Empty
        title={unavailable}
        description="This file change has no code preview."
      />
    );
  if (parsed?.kind === 'invalid')
    return (
      <ErrorState
        message="The patch could not be parsed"
        retry={{ label: 'Retry', onPress: patch.retry }}
      />
    );
  if (parsed?.kind === 'text')
    return (
      <DiffView
        lines={parsed.lines}
        wrap={preferences.lineOverflow === 'wrap'}
      />
    );
  return (
    <Empty
      title="No code change"
      description="This comparison has no changed lines."
    />
  );
}
