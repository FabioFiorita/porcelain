import type { CommitFile, CommitSummary } from './commit.ts';
import type {
  ListCommitsResponse,
  ReadChangesResponse,
} from '@porcelain/contracts/changes';

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
const SHORT_OID_LENGTH = 7;
export function shortOid(oid: string) {
  return oid.slice(0, SHORT_OID_LENGTH);
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

export type BranchTracking = {
  name: string;
  counts: string | null;
  upstream: string;
};

export function branchTracking(
  branch: ReadChangesResponse['branch'],
  snapshot: ListCommitsResponse['snapshot'] | null,
): BranchTracking {
  if (branch === null || branch === undefined)
    return {
      name: historyHeading(snapshot),
      counts: null,
      upstream: 'Branch status unavailable',
    };
  if (branch.name === null || branch.name === undefined)
    return {
      name: 'Detached HEAD',
      counts: null,
      upstream: 'No branch checked out',
    };
  if (branch.upstream === null || branch.upstream === undefined)
    return { name: refLabel(branch.name), counts: null, upstream: 'No upstream' };
  return {
    name: refLabel(branch.name),
    counts: `${branch.ahead} ahead · ${branch.behind} behind`,
    upstream: `against ${refLabel(branch.upstream)}`,
  };
}
