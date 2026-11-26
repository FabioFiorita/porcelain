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

export function receiptWords(receipt: Receipt) {
  if (receipt.action.startsWith('stash-')) {
    if (receipt.state === 'interrupted' || receipt.state === 'conflicted')
      return stateWords[receipt.state];
    if (receipt.state === 'rejected' && receipt.reason === 'GIT_REJECTED')
      return receipt.action === 'stash-create'
        ? 'Git could not set these changes aside.'
        : 'Git could not restore this stash.';
  }
  return (
    receipt.message ??
    (receipt.reason
      ? receipt.reason.replaceAll('_', ' ').toLowerCase()
      : stateWords[receipt.state])
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
