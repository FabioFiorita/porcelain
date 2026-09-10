import { lstat } from 'node:fs/promises';
import { readActionCommand } from '../commands/read-action-command.ts';
import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';

export async function rejectBusyCheckout(
  process: GitProcessRunner,
  signal: AbortSignal,
): Promise<void> {
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
    throw new GitActionRejectedError('CHECKOUT_BUSY');
  }
}
