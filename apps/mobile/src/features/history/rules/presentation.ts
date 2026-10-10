import type {
  CommitFile,
  CommitSummary,
} from '@porcelain/client/history/rules';
import type { ListCommitsResponse } from '@porcelain/contracts/changes';
import type { DiffContent } from '@porcelain/client/changes/rules';

export function commitPaths(file: CommitFile): string[] {
  return [
    ...new Set(
      [file.oldPath, file.newPath].filter(
        (path): path is string => path !== undefined && path !== null,
      ),
    ),
  ];
}
export function commitPath(file: CommitFile) {
  return file.newPath ?? file.oldPath ?? 'Unknown path';
}
export function shortOid(oid: string) {
  return oid.slice(0, 8);
}
export function refLabel(ref: string) {
  return ref.replace(/^refs\/(?:heads|remotes|tags)\//u, '');
}
export function commitEntry(commit: CommitSummary) {
  return {
    id: commit.oid,
    subject: commit.subject,
    author: commit.author.name,
    time: new Date(commit.author.timestamp).toLocaleString(),
    shortHash: shortOid(commit.oid),
    refs: commit.refs.map(refLabel),
  };
}
export function historyHeading(
  snapshot: ListCommitsResponse['snapshot'] | null,
) {
  switch (snapshot?.head.kind) {
    case 'attached':
      return refLabel(snapshot.head.ref);
    case 'unborn':
      return `No commits yet on ${refLabel(snapshot.head.ref)}`;
    case 'detached':
      return 'Detached HEAD';
    default:
      return 'This branch';
  }
}
export function historyBoundary(
  boundary: ListCommitsResponse['boundary'] | null,
) {
  return boundary === 'shallow'
    ? 'Shallow clone: older history is not available.'
    : boundary === 'wide'
      ? 'Too many branches meet here to continue past this point.'
      : 'Start of history.';
}
export function patchUnavailable(content: DiffContent) {
  switch (content.kind) {
    case 'binary':
      return 'Binary change';
    case 'metadata-only':
      return 'No code change';
    case 'omitted':
      return content.reason === 'size-limit'
        ? 'Too large to show'
        : content.reason === 'unsupported-submodule'
          ? 'Submodule change'
          : 'Cannot be shown';
    case 'text':
      return undefined;
  }
}
