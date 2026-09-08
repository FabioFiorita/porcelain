import { devNull } from 'node:os';
import type {
  CommitChange,
  CommitChanges,
  CommitChangesRequest,
  HistoryCheckout,
} from '../dtos/commit-history.ts';
import { HistorySnapshotUnavailableError } from '../errors/history-snapshot-unavailable-error.ts';
import { InvalidHistoryRequestError } from '../errors/invalid-history-request-error.ts';
import { ReadLimitExceededError } from '../errors/read-limit-exceeded-error.ts';
import { UnsupportedHistoryDataError } from '../errors/unsupported-history-data-error.ts';
import { executeHistoryCommand } from '../execute-history-command.ts';
import { inspectHistoryCheckout } from './inspect-history-checkout.ts';
import { readCommit } from './read-commit.ts';

const statuses = {
  A: 'added',
  D: 'deleted',
  M: 'modified',
  R: 'renamed',
  T: 'type-changed',
} as const;
function parseChanges(raw: string): CommitChange[] {
  const tokens = raw.split('\0');
  const changes: CommitChange[] = [];
  while (tokens.length > 1) {
    const header = tokens
      .shift()
      ?.match(/^:(\d{6}) (\d{6}) [0-9a-f]+ [0-9a-f]+ ([ADMRT])\d*$/);
    const path = tokens.shift();
    if (!header || path === undefined || !header[1] || !header[2])
      throw new UnsupportedHistoryDataError();
    const code = header[3] as keyof typeof statuses;
    const newPath = code === 'R' ? tokens.shift() : path;
    if (newPath === undefined) throw new UnsupportedHistoryDataError();
    changes.push({
      oldPath: code === 'A' ? null : path,
      newPath: code === 'D' ? null : newPath,
      oldMode: header[1],
      newMode: header[2],
      status: statuses[code],
      patch: { kind: 'text', text: '' },
    });
    if (changes.length > 500) throw new ReadLimitExceededError();
  }
  return changes;
}
function withPatches(changes: CommitChange[], output: string): CommitChange[] {
  const patches = output.split(/(?=^diff --git )/m).filter(Boolean);
  // Git represents a type change as a deletion and addition in patch output,
  // while raw output retains a single T record for that path.
  const sectionCount = (change: CommitChange) =>
    change.status === 'type-changed' ? 2 : 1;
  const expectedSections = changes.reduce(
    (total, change) => total + sectionCount(change),
    0,
  );
  if (patches.length !== expectedSections)
    throw new UnsupportedHistoryDataError();
  return changes.map((change) => {
    const text = patches.splice(0, sectionCount(change)).join('');
    if (change.oldMode === '160000' || change.newMode === '160000')
      return { ...change, patch: { kind: 'submodule', text } };
    if (/^Binary files .* differ$/m.test(text))
      return { ...change, patch: { kind: 'binary' } };
    return { ...change, patch: { kind: 'text', text } };
  });
}
export async function inspectCommitChanges(
  checkout: HistoryCheckout,
  request: CommitChangesRequest,
  signal?: AbortSignal,
): Promise<CommitChanges> {
  if (
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(request.oid) ||
    (request.parent !== undefined &&
      (!Number.isInteger(request.parent) || request.parent < 1))
  )
    throw new InvalidHistoryRequestError();
  const graph = await inspectHistoryCheckout(checkout, signal);
  const commit = await readCommit(checkout.path, request.oid, signal);
  const parentNumber = request.parent ?? 1;
  const baseOid = commit.parentOids[parentNumber - 1];
  if (
    (!baseOid && commit.parentOids.length > 0) ||
    (commit.parentOids.length === 0 && request.parent !== undefined)
  )
    throw new InvalidHistoryRequestError();
  const comparison: CommitChanges['comparison'] = baseOid
    ? { kind: 'parent', parentNumber, baseOid }
    : { kind: 'empty-tree' };
  const revisions = baseOid ? [baseOid, request.oid] : ['--root', request.oid];
  const args = [
    'diff-tree',
    '--no-commit-id',
    '-r',
    '--no-ext-diff',
    '--no-textconv',
    '--no-color',
    '--no-relative',
    '--ignore-submodules=none',
    '--submodule=short',
    '--no-renames',
    '--find-renames=50%',
    '-l1000',
    '-O',
    devNull,
    '--diff-algorithm=myers',
    '--no-indent-heuristic',
    '--src-prefix=a/',
    '--dst-prefix=b/',
  ];
  const raw = await executeHistoryCommand(
    checkout.path,
    [...args, '--raw', '-z', ...revisions, '--'],
    signal,
  );
  const changes = parseChanges(raw);
  const patch = changes.length
    ? await executeHistoryCommand(
        checkout.path,
        [...args, '--patch', '--unified=3', ...revisions, '--'],
        signal,
      )
    : '';
  const result: CommitChanges = {
    commitOid: request.oid,
    parentOids: commit.parentOids,
    comparison,
    changes: withPatches(changes, patch),
  };
  if (Buffer.byteLength(JSON.stringify(result)) > 1024 * 1024)
    throw new ReadLimitExceededError();
  if ((await inspectHistoryCheckout(checkout, signal)) !== graph)
    throw new HistorySnapshotUnavailableError();
  return result;
}
