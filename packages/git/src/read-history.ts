import { GitCommandError } from './errors/git-command-error.ts';
import { HistorySnapshotUnavailableError } from './errors/history-snapshot-unavailable-error.ts';
import { ReadLimitExceededError } from './errors/read-limit-exceeded-error.ts';
import { UnsupportedHistoryDataError } from './errors/unsupported-history-data-error.ts';
import { classifyGitFailure, runGitRead } from './run-git.ts';

/**
 * History reads over the one runner: literal pathspecs so a path is never read
 * as a pattern, no signature verification, and strict decoding so unusual or
 * corrupted data fails explicitly rather than arriving as replacement
 * characters. Only the error mapping is history's own.
 */
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
