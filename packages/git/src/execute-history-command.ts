import { GitCommandError } from './errors/git-command-error.ts';
import { HistorySnapshotUnavailableError } from './errors/history-snapshot-unavailable-error.ts';
import { ReadLimitExceededError } from './errors/read-limit-exceeded-error.ts';
import { UnsupportedHistoryDataError } from './errors/unsupported-history-data-error.ts';
import { executeCommand } from './execute-command.ts';

export async function executeHistoryCommand(
  checkout: string,
  args: string[],
  signal?: AbortSignal,
): Promise<string> {
  try {
    return await executeCommand(
      checkout,
      [
        '--no-replace-objects',
        '--literal-pathspecs',
        '-c',
        'core.fsmonitor=false',
        '-c',
        'core.quotePath=true',
        '-c',
        'log.showSignature=false',
        ...args,
      ],
      signal,
      true,
    );
  } catch (cause) {
    if (!(cause instanceof GitCommandError) || !(cause.cause instanceof Error))
      throw cause;
    const failure = cause.cause;
    const code = 'code' in failure ? failure.code : undefined;
    if (code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER')
      throw new ReadLimitExceededError(cause);
    if (code === 'ERR_ENCODING_INVALID_ENCODED_DATA')
      throw new UnsupportedHistoryDataError(cause);
    if ('killed' in failure && failure.killed)
      throw Object.assign(
        new DOMException('History read timed out', 'TimeoutError'),
        { cause },
      );
    if (typeof code === 'number')
      throw new HistorySnapshotUnavailableError(cause);
    throw cause;
  }
}
