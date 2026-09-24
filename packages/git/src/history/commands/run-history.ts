import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { GitCommandError } from '../../shared/errors/git-command-error.ts';
import { GitOutputLimitError } from '../../shared/errors/git-output-limit-error.ts';
import { runGitRead } from '../../shared/run-git.ts';
import { HistorySnapshotUnavailableError } from '../errors/history-snapshot-unavailable-error.ts';
import { ReadLimitExceededError } from '../errors/read-limit-exceeded-error.ts';

export async function runHistory(
  checkout: string,
  args: readonly string[],
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<Buffer> {
  try {
    return await read(checkout, args, limits, signal);
  } catch (cause) {
    throw historyFailure(cause);
  }
}

export async function askHistory(
  checkout: string,
  args: readonly string[],
  limits: GitLimits,
  signal: AbortSignal | undefined,
  answersNo: (failure: GitCommandError) => boolean,
): Promise<boolean> {
  try {
    await read(checkout, args, limits, signal);
    return true;
  } catch (cause) {
    if (cause instanceof GitCommandError && answersNo(cause)) return false;
    throw historyFailure(cause);
  }
}

function read(
  checkout: string,
  args: readonly string[],
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<Buffer> {
  return runGitRead(checkout, args, limits, signal, {
    leading: ['--literal-pathspecs'],
    config: ['log.showSignature=false'],
  });
}

function historyFailure(cause: unknown): unknown {
  if (cause instanceof GitOutputLimitError)
    return new ReadLimitExceededError({ cause });
  if (cause instanceof GitCommandError && cause.exitCode !== undefined)
    return new HistorySnapshotUnavailableError({ cause });
  return cause;
}
