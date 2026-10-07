import { runGitEffect } from '../../shared/commands/run-git.ts';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isMissing } from '../../shared/errors/is-missing.ts';
import {
  readCommonDirectory,
  readGitDirectory,
} from '../../shared/commands/gitdir.ts';
import { identity } from '../../shared/commands/identity.ts';
import type {
  HistoryCheckout,
  HistorySnapshot,
} from '../dtos/commit-history.ts';
import { HistoryWorktreeUnavailableError } from '../../shared/errors/history-worktree-unavailable-error.ts';

export async function confirmHistoryCheckout(
  checkout: HistoryCheckout,
  signal?: AbortSignal,
): Promise<{ common: string }> {
  signal?.throwIfAborted();
  try {
    const gitDirectory = await runGitEffect(
      readGitDirectory(checkout.path),
      signal,
    );
    if (gitDirectory === undefined) throw new HistoryWorktreeUnavailableError();
    const common = await runGitEffect(
      readCommonDirectory(gitDirectory),
      signal,
    );
    if (
      (await runGitEffect(identity(gitDirectory), signal)) !==
        checkout.metadataIdentity ||
      (await runGitEffect(identity(common), signal)) !==
        checkout.repositoryIdentity
    )
      throw new HistoryWorktreeUnavailableError();
    return { common };
  } catch (cause) {
    if (cause instanceof HistoryWorktreeUnavailableError) throw cause;
    throw new HistoryWorktreeUnavailableError({ cause });
  }
}

export async function inspectHistoryCheckout(
  checkout: HistoryCheckout,
  gitVersion: Buffer,
  signal?: AbortSignal,
): Promise<HistorySnapshot> {
  const { common } = await confirmHistoryCheckout(checkout, signal);
  try {
    const shallow = await readShallowBoundary(join(common, 'shallow'));
    return {
      graph: createHash('sha256')
        .update(gitVersion)
        .update(shallow)
        .digest('hex'),
      shallow: shallow.length > 0,
    };
  } catch (cause) {
    throw new HistoryWorktreeUnavailableError({ cause });
  }
}

async function readShallowBoundary(path: string): Promise<Buffer> {
  try {
    return await readFile(path);
  } catch (error) {
    if (isMissing(error)) return Buffer.alloc(0);
    throw error;
  }
}
