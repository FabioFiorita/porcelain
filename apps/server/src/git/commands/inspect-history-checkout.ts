import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import type { HistoryCheckout } from '../dtos/commit-history.ts';
import { HistorySnapshotUnavailableError } from '../errors/history-snapshot-unavailable-error.ts';
import { HistoryWorktreeUnavailableError } from '../errors/history-worktree-unavailable-error.ts';
import { isRepositoryUnavailable } from '../errors/is-repository-unavailable.ts';
import { executeHistoryCommand } from '../execute-history-command.ts';

async function identity(path: string): Promise<string> {
  const value = await stat(path, { bigint: true });
  return `${value.dev}:${value.ino}:${value.birthtimeNs}`;
}
async function inspectCheckout(
  checkout: HistoryCheckout,
  signal?: AbortSignal,
): Promise<string> {
  signal?.throwIfAborted();
  const common = (
    await executeHistoryCommand(
      checkout.path,
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      signal,
    )
  ).slice(0, -1);
  const metadata = (
    await executeHistoryCommand(
      checkout.path,
      ['rev-parse', '--absolute-git-dir'],
      signal,
    )
  ).slice(0, -1);
  if (
    (await identity(common)) !== checkout.repositoryIdentity ||
    (await identity(metadata)) !== checkout.metadataIdentity
  )
    throw new HistoryWorktreeUnavailableError();
  const shallowPath = (
    await executeHistoryCommand(
      checkout.path,
      ['rev-parse', '--path-format=absolute', '--git-path', 'shallow'],
      signal,
    )
  ).slice(0, -1);
  const shallow = await readFile(shallowPath).catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return Buffer.alloc(0);
    throw error;
  });
  const version = await executeHistoryCommand(
    checkout.path,
    ['--version'],
    signal,
  );
  return createHash('sha256').update(version).update(shallow).digest('hex');
}

export async function inspectHistoryCheckout(
  checkout: HistoryCheckout,
  signal?: AbortSignal,
): Promise<string> {
  try {
    return await inspectCheckout(checkout, signal);
  } catch (cause) {
    if (
      cause instanceof HistorySnapshotUnavailableError ||
      isRepositoryUnavailable(cause)
    )
      throw new HistoryWorktreeUnavailableError(cause);
    throw cause;
  }
}
