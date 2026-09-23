import { lstat } from 'node:fs/promises';
import { readActionCommand } from './read-action-command.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';

export async function rejectBusyCheckout(
  process: GitProcessRunner,
  signal: AbortSignal,
  allowMerge = false,
  ignoreIndexLock = false,
): Promise<'merge' | null> {
  let merge = false;
  for (const name of [
    'MERGE_HEAD',
    'CHERRY_PICK_HEAD',
    'REVERT_HEAD',
    'rebase-merge',
    'rebase-apply',
    'sequencer',
    'index.lock',
  ]) {
    const path = (
      await readActionCommand(
        process,
        ['rev-parse', '--path-format=absolute', '--git-path', name],
        signal,
      )
    ).trimEnd();
    try {
      await lstat(path);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        continue;
      throw error;
    }
    if (name === 'MERGE_HEAD' && allowMerge) {
      merge = true;
      continue;
    }
    if (name === 'index.lock' && ignoreIndexLock) continue;
    throw new GitActionRejectedError('CHECKOUT_BUSY');
  }
  return merge ? 'merge' : null;
}
