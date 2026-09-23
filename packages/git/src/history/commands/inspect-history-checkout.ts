import { createHash } from 'node:crypto';
import { lstat, readFile, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import type {
  HistoryCheckout,
  HistorySnapshot,
} from '../dtos/commit-history.ts';
import { HistoryWorktreeUnavailableError } from '../errors/history-worktree-unavailable-error.ts';
import { readGitVersion } from '../../discovery/read-git-version.ts';

const identity = (value: { dev: bigint; ino: bigint; birthtimeNs: bigint }) =>
  `${value.dev}:${value.ino}:${value.birthtimeNs}`;

async function liveDirectories(path: string) {
  const dotGit = join(path, '.git');
  const marker = await lstat(dotGit, { bigint: true });
  let administrative = dotGit;
  if (!marker.isDirectory()) {
    const named = (await readFile(dotGit, 'utf8')).match(/^gitdir: (.+)$/mu);
    if (!named?.[1]) throw new HistoryWorktreeUnavailableError();
    const target = named[1].trim();
    administrative = isAbsolute(target) ? target : resolve(path, target);
  }
  const metadata = await stat(administrative, { bigint: true });
  let common = administrative;
  try {
    const named = await readFile(join(administrative, 'commondir'), 'utf8');
    const target = named.trim();
    common = isAbsolute(target) ? target : resolve(administrative, target);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  return { common, repository: await stat(common, { bigint: true }), metadata };
}

export async function confirmHistoryCheckout(
  checkout: HistoryCheckout,
  signal?: AbortSignal,
): Promise<{ common: string }> {
  signal?.throwIfAborted();
  try {
    const live = await liveDirectories(checkout.path);
    if (
      identity(live.metadata) !== checkout.metadataIdentity ||
      identity(live.repository) !== checkout.repositoryIdentity
    )
      throw new HistoryWorktreeUnavailableError();
    return { common: live.common };
  } catch (cause) {
    if (cause instanceof HistoryWorktreeUnavailableError) throw cause;
    throw new HistoryWorktreeUnavailableError(cause);
  }
}

export async function inspectHistoryCheckout(
  checkout: HistoryCheckout,
  signal?: AbortSignal,
): Promise<HistorySnapshot> {
  const { common } = await confirmHistoryCheckout(checkout, signal);
  try {
    const shallow = await readShallowBoundary(join(common, 'shallow'));
    const version = await readGitVersion();
    return {
      graph: createHash('sha256').update(version).update(shallow).digest('hex'),
      shallow: shallow.length > 0,
    };
  } catch (cause) {
    throw new HistoryWorktreeUnavailableError(cause);
  }
}

const isMissing = (error: unknown) =>
  error instanceof Error &&
  'code' in error &&
  (error.code === 'ENOENT' || error.code === 'ENOTDIR');

async function readShallowBoundary(path: string) {
  try {
    return await readFile(path);
  } catch (error) {
    if (isMissing(error)) return Buffer.alloc(0);
    throw error;
  }
}
