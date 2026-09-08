import { GitActionRejectedError } from '../errors/git-action-rejected-error.ts';
import type { GitProcessRunner } from '../interfaces/git-process-runner.ts';
import { processFailure } from './action-outcome.ts';
import { readActionCommand } from './read-action-command.ts';

export async function checkStashCollisions(
  process: GitProcessRunner,
  stashOid: string,
  signal: AbortSignal,
): Promise<void> {
  const ignored = (
    await readActionCommand(
      process,
      ['ls-files', '--others', '--ignored', '--exclude-standard', '-z'],
      signal,
    )
  )
    .split('\0')
    .filter(Boolean);
  if (!ignored.length) return;
  const paths = (
    await readActionCommand(
      process,
      ['ls-tree', '-r', '--name-only', '-z', stashOid],
      signal,
    )
  )
    .split('\0')
    .filter(Boolean);
  const third = await process.execute(
    ['rev-parse', '--verify', '--quiet', `${stashOid}^3`],
    signal,
  );
  const failure = processFailure(third);
  if (failure?.state === 'indeterminate')
    throw new GitActionRejectedError(failure.reason ?? 'GIT_REJECTED');
  signal.throwIfAborted();
  const untracked =
    third.exitCode === 0
      ? (
          await readActionCommand(
            process,
            ['ls-tree', '-r', '--name-only', '-z', `${stashOid}^3`],
            signal,
          )
        )
          .split('\0')
          .filter(Boolean)
      : [];
  const collisions = [...paths, ...untracked].some((path) =>
    ignored.some(
      (entry) =>
        entry === path ||
        entry.startsWith(`${path}/`) ||
        path.startsWith(`${entry}/`),
    ),
  );
  if (collisions) throw new GitActionRejectedError('CHECKOUT_BUSY');
}
