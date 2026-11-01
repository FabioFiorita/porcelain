import type { ReviewRange } from '../../../components/ui/review-annotation';
import {
  DocumentComments,
  commitCommentTarget,
  type DocumentCodeSelection,
} from '../../reviews';
import { CommitReadState } from './commit-state';
import { Box } from '../../../components/ui/box';
import { AsyncResult } from 'effect/reactivity';
import type { CommitFile } from '@porcelain/client/history/rules';
import { Empty } from '../../../components/ui/empty';
import { ErrorState } from '../../../components/ui/error-state';
import { Loading } from '../../../components/ui/loading';
import { FileHeader } from '../../../components/ui/file-header';
import { DiffView } from '../../../components/ui/diff-view';
import { diffLines } from '@porcelain/client/changes/rules';
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
  inlineComments,
  leaveScope,
}: {
  selection: HistorySelection;
  oid: string;
  parent: number;
  path: string;
  inlineComments?: boolean | undefined;
  leaveScope?: string | undefined;
}) {
  const commit = useCommit(selection, oid, parent);
  const file = commit.value?.files.find(
    (candidate) => commitPath(candidate) === path,
  );
  const content = (codeSelection?: DocumentCodeSelection) => (
    <CommitReadState commit={commit}>
      {(value) => (
        <CommitFileContent
          selection={selection}
          oid={oid}
          parent={parent}
          path={path}
          files={value.files}
          inlineComments={inlineComments}
          codeSelection={codeSelection}
        />
      )}
    </CommitReadState>
  );
  return inlineComments ? (
    <DocumentComments
      workspace={selection}
      leaveScope={leaveScope}
      path={path}
      document={JSON.stringify(['commit-diff', oid, parent, path])}
      target={commitCommentTarget(path, oid, parent)}
      renderToolbar={(actions) => (
        <FileHeader
          path={path}
          documentToolbar
          {...(file ? { status: file.status } : {})}
          actions={actions}
        />
      )}
    >
      {(codeSelection) => content(codeSelection)}
    </DocumentComments>
  ) : (
    content()
  );
}

function CommitFileContent({
  selection,
  oid,
  parent,
  path,
  files,
  inlineComments,
  codeSelection,
}: {
  selection: HistorySelection;
  oid: string;
  parent: number;
  path: string;
  files: readonly CommitFile[];
  inlineComments?: boolean | undefined;
  codeSelection?: DocumentCodeSelection | undefined;
}) {
  const file = files.find((candidate) => commitPath(candidate) === path);
  return (
    <Box className="flex-1" surface="background">
      {file ? (
        <FilePatch
          selection={selection}
          oid={oid}
          parent={parent}
          file={file}
          inlineComments={inlineComments}
          codeSelection={codeSelection}
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
  inlineComments,
  codeSelection,
}: {
  selection: HistorySelection;
  oid: string;
  parent: number;
  file: CommitFile;
  inlineComments?: boolean | undefined;
  codeSelection?: DocumentCodeSelection | undefined;
}) {
  return (
    <>
      {!inlineComments ? (
        <FileHeader path={commitPath(file)} status={file.status} />
      ) : null}
      <FilePatchContent
        selection={selection}
        oid={oid}
        parent={parent}
        file={file}
        selectionRange={codeSelection?.selection}
        onSelect={codeSelection?.onSelect}
      />
    </>
  );
}

function FilePatchContent({
  selection,
  oid,
  parent,
  file,
  selectionRange,
  onSelect,
}: {
  selection: HistorySelection;
  oid: string;
  parent: number;
  file: CommitFile;
  selectionRange?: ReviewRange | undefined;
  onSelect?: ((range: ReviewRange) => void) | undefined;
}) {
  const { preferences } = usePreferences();
  const patch = useCommitPatch(selection, oid, parent, commitPaths(file));
  const content = patch.value;
  const parsed =
    content?.kind === 'text' ? diffLines(content.patch) : undefined;
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
        selection={selectionRange}
        onSelect={onSelect}
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
