import { devNull } from 'node:os';
import type {
  CommitChanges,
  CommitChangesRequest,
  HistoryCheckout,
} from '../dtos/commit-history.ts';
import { HistorySnapshotUnavailableError } from '../errors/history-snapshot-unavailable-error.ts';
import { InvalidHistoryRequestError } from '../errors/invalid-history-request-error.ts';
import { ReadLimitExceededError } from '../errors/read-limit-exceeded-error.ts';
import { executeHistoryCommand } from '../execute-history-command.ts';
import {
  attachCommitPatches,
  parseCommitChanges,
} from '../mappers/parse-commit-changes.ts';
import { inspectHistoryCheckout } from './inspect-history-checkout.ts';
import { readCommit } from './read-commit.ts';

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
  const changes = parseCommitChanges(raw);
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
    changes: attachCommitPatches(changes, patch),
  };
  if (Buffer.byteLength(JSON.stringify(result)) > 1024 * 1024)
    throw new ReadLimitExceededError();
  if ((await inspectHistoryCheckout(checkout, signal)) !== graph)
    throw new HistorySnapshotUnavailableError();
  return result;
}
