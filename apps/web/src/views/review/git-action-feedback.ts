import type { Expectation, Receipt } from '../../domain/git-action';
import type { GitActionStatus } from './git-action-options';

export function expectationFor(
  status: GitActionStatus,
  paths: readonly string[] = [],
  upstreamOid?: string | null,
  includeFiles = paths.length > 0,
): Expectation {
  const wanted = new Set(paths);
  return {
    headOid: status.headOid ?? null,
    inProgress: status.inProgress ?? null,
    mergeHeadOid: status.mergeHeadOid ?? null,
    branch: status.branch?.name?.replace(/^refs\/heads\//, '') ?? null,
    ...(upstreamOid !== undefined ? { upstreamOid } : {}),
    ...(includeFiles
      ? {
          files: (status.files ?? []).flatMap((file) =>
            wanted.has(file.path) && file.fingerprint != null
              ? [{ path: file.path, fingerprint: file.fingerprint }]
              : [],
          ),
        }
      : {}),
  };
}

export const receiptFailed = (receipt: Receipt) =>
  !['succeeded', 'no-change'].includes(receipt.state);

export const receiptWords = (receipt: Receipt) =>
  receipt.message ??
  (receipt.reason
    ? receipt.reason.replaceAll('_', ' ').toLowerCase()
    : `Git ${receipt.state}`);

export const changedSinceLooked = (receipt: Receipt) =>
  receipt.state === 'rejected' && receipt.reason === 'CHANGED_SINCE_LOOKED';

export function gitErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Git could not complete this action. Check the current state and try again.';
}
