import { GitCommandError } from '../../shared/errors/git-command-error.ts';
import { runInspection } from './run-inspection.ts';

const NOTHING_IGNORED = 1;

export async function checkIgnored(
  checkout: string,
  paths: readonly string[],
  signal?: AbortSignal,
): Promise<Set<string>> {
  const wanted = [...new Set(paths)];
  if (wanted.length === 0) return new Set();
  let output: Buffer;
  try {
    output = await runInspection(
      checkout,
      ['check-ignore', '-z', '--stdin'],
      signal,
      {
        maxBytes: 1024 * 1024,
        input: Buffer.from(`${wanted.join('\0')}\0`),
      },
    );
  } catch (error) {
    if (error instanceof GitCommandError && error.exitCode === NOTHING_IGNORED)
      return new Set();
    throw error;
  }
  return new Set(output.toString('utf8').split('\0').filter(Boolean));
}
