import { GitCommandError } from '../shared/errors/git-command-error.ts';
import { HistorySnapshotUnavailableError } from './errors/history-snapshot-unavailable-error.ts';
import { ReadLimitExceededError } from '../inspection/errors/read-limit-exceeded-error.ts';
import { UnsupportedHistoryDataError } from './errors/unsupported-history-data-error.ts';
import { classifyGitFailure, runGitRead } from '../shared/run-git.ts';

export async function readHistory(
  checkout: string,
  args: string[],
  signal?: AbortSignal,
): Promise<string> {
  let output: Buffer;
  try {
    output = await runGitRead(checkout, args, signal, {
      leading: ['--literal-pathspecs'],
      config: ['log.showSignature=false'],
    });
  } catch (cause) {
    throw historyFailure(cause);
  }
  try {
    return new TextDecoder('utf8', { fatal: true }).decode(output);
  } catch (cause) {
    throw new UnsupportedHistoryDataError(
      new GitCommandError(checkout, args, cause),
    );
  }
}

function historyFailure(cause: unknown): unknown {
  if (!(cause instanceof GitCommandError)) return cause;
  switch (classifyGitFailure(cause.cause)) {
    case 'output-limit':
      return new ReadLimitExceededError(cause);
    case 'invalid-encoding':
      return new UnsupportedHistoryDataError(cause);
    case 'timeout':
      return Object.assign(
        new DOMException('History read timed out', 'TimeoutError'),
        { cause },
      );
    case 'exit':
      return new HistorySnapshotUnavailableError(cause);
    default:
      return cause;
  }
}

const UNKNOWN_REVISION =
  /(?:not a valid (?:commit name|object name)|unknown revision|bad revision|ambiguous argument)/iu;

export async function askHistory(
  checkout: string,
  args: string[],
  signal?: AbortSignal,
  options: { missingRevisionIsNo?: boolean } = {},
): Promise<boolean> {
  try {
    await runGitRead(checkout, args, signal, {
      leading: ['--literal-pathspecs'],
      config: ['log.showSignature=false'],
    });
    return true;
  } catch (cause) {
    if (!(cause instanceof GitCommandError)) throw historyFailure(cause);
    const failure = cause.cause;
    if (
      classifyGitFailure(failure) === 'exit' &&
      failure instanceof Error &&
      'code' in failure
    ) {
      if (failure.code === 1) return false;
      if (
        failure.code === 128 &&
        options.missingRevisionIsNo === true &&
        UNKNOWN_REVISION.test(stderrOf(failure))
      )
        return false;
    }
    throw historyFailure(cause);
  }
}

function stderrOf(failure: Error): string {
  const value = 'stderr' in failure ? failure.stderr : undefined;
  if (typeof value === 'string') return value;
  return Buffer.isBuffer(value) ? value.toString('utf8') : '';
}
