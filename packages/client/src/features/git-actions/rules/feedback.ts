import { isSchemaError } from 'effect/Schema';
import type { Expectation, Receipt } from './git-action.ts';
import type { GitActionStatus } from './status.ts';

export function expectationFor(
  status: GitActionStatus,
  paths: readonly string[] = [],
  upstreamOid?: string | null,
  includeFiles = paths.length > 0,
): Expectation {
  const wanted = new Set(paths);
  return {
    headOid: status.headOid ?? undefined,
    inProgress: status.inProgress ?? undefined,
    mergeHeadOid: status.mergeHeadOid ?? undefined,
    branch: status.branch?.name ?? undefined,
    ...(upstreamOid !== undefined ? { upstreamOid } : {}),
    ...(includeFiles
      ? {
          files: (status.files ?? []).flatMap((file) =>
            wanted.has(file.path) &&
            file.fingerprint !== null &&
            file.fingerprint !== undefined
              ? [{ path: file.path, fingerprint: file.fingerprint }]
              : [],
          ),
        }
      : {}),
  };
}

export const receiptFailed = (receipt: Receipt) =>
  !['succeeded', 'no-change'].includes(receipt.state);

export const receiptSettled = (receipt: Receipt) =>
  !['running', 'interrupted'].includes(receipt.state);

const stateWords: Record<Receipt['state'], string> = {
  running: 'Git is still working.',
  succeeded: 'Git finished.',
  'no-change': 'Nothing changed.',
  rejected: 'Git refused the change.',
  conflicted: 'Some files conflict. Resolve them, then commit.',
  interrupted: 'Git stopped before Porcelain could confirm the result.',
};

const reasonWords: Record<NonNullable<Receipt['reason']>, string> = {
  CHANGED_SINCE_LOOKED: 'The files changed after you looked at them.',
  STALE_PREPARATION: 'The worktree changed while Git was preparing this.',
  REQUEST_MISMATCH: 'The request no longer matches the worktree.',
  CHECKOUT_BUSY: 'Another Git action is running in this worktree.',
  UNSUPPORTED_CONFIGURATION: 'Porcelain does not support this Git setup.',
  NON_FAST_FORWARD: 'The remote has commits this branch does not. Pull first.',
  GIT_REJECTED: 'Git refused the change.',
  DEADLINE_EXCEEDED: 'Git took too long and was stopped.',
  OUTCOME_UNKNOWN: 'Porcelain could not confirm the outcome.',
  PROCESS_GROUP_UNCONFIRMED: 'Porcelain could not confirm that Git stopped.',
  TOO_MANY_CHANGES:
    'Porcelain cannot list every change in this worktree; finish this in a terminal.',
};

const UNLISTED_CHANGES_WORDS =
  'Porcelain cannot list every change in this worktree; finish this in a terminal.';

function stashRefusal(receipt: Receipt) {
  switch (receipt.reason) {
    case 'CHECKOUT_BUSY':
      return 'Git cannot change this checkout right now; finish any operation in progress and try again.';
    case 'CHANGED_SINCE_LOOKED':
      return changedSinceLookedText([]);
    case 'TOO_MANY_CHANGES':
      return UNLISTED_CHANGES_WORDS;
    default:
      return receipt.action === 'stash-create'
        ? 'Git could not set these changes aside.'
        : 'Git could not restore this stash.';
  }
}

export function receiptWords(receipt: Receipt) {
  if (receipt.action.startsWith('stash-')) {
    if (receipt.state === 'interrupted' || receipt.state === 'conflicted')
      return stateWords[receipt.state];
    if (receipt.state === 'rejected') return stashRefusal(receipt);
  }
  if (receipt.reason === 'TOO_MANY_CHANGES') return UNLISTED_CHANGES_WORDS;
  return (
    receipt.message ??
    (receipt.reason ? reasonWords[receipt.reason] : stateWords[receipt.state])
  );
}

export const changedSinceLooked = (receipt: Receipt) =>
  receipt.state === 'rejected' && receipt.reason === 'CHANGED_SINCE_LOOKED';

export function changedSinceLookedPaths(
  looked: GitActionStatus,
  current: GitActionStatus,
): string[] {
  const fingerprints = (status: GitActionStatus) =>
    new Map(
      (status.files ?? []).map((file) => [file.path, file.fingerprint ?? null]),
    );
  const before = fingerprints(looked);
  const after = fingerprints(current);
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter(
      (path) =>
        before.has(path) !== after.has(path) ||
        before.get(path) !== after.get(path),
    )
    .sort();
}

export function changedSinceLookedText(paths: readonly string[]) {
  const [first] = paths;
  const changed =
    first === undefined
      ? 'The worktree'
      : paths.length === 1
        ? first
        : `${first} and ${paths.length - 1} more`;
  return `${changed} changed after this was read. Look again before trying.`;
}

export function gitErrorMessage(error: unknown) {
  return error instanceof Error && !isSchemaError(error)
    ? error.message
    : 'Git could not complete this action.';
}

export type GitNotice = {
  title: string;
  description?: string | undefined;
  type: 'success' | 'error' | 'info';
  timeout?: number;
  actionProps?: { children: string; onClick: () => void };
};
