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

/**
 * Messages Git uses when the revision it was asked about is simply not there.
 *
 * Narrow on purpose: every other fatal failure — a corrupted config, an
 * unreadable object store — exits 128 too, and answering "no" to those would
 * turn a broken repository into an empty one.
 */
const UNKNOWN_REVISION =
  /(?:not a valid (?:commit name|object name)|unknown revision|bad revision|ambiguous argument)/iu;

/**
 * A history command whose exit status is its answer rather than a failure.
 *
 * `merge-base --is-ancestor` and `rev-parse --verify --quiet` say no by
 * exiting 1. A commit that has been pruned away answers the same question —
 * the history that held it is gone — but Git reports that as a fatal error, so
 * it is only read as "no" when Git says the revision is unknown and the caller
 * asked about one commit rather than about the repository.
 */
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
