import { GitCommandError } from '../../shared/errors/git-command-error.ts';
import { runInspection } from '../read-inspection.ts';

const MAX_OUTPUT_BYTES = 1024 * 1024;

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
        maxBytes: MAX_OUTPUT_BYTES,
        input: Buffer.from(`${wanted.join('\0')}\0`),
      },
    );
  } catch (error) {
    if (nothingMatched(error)) return new Set();
    throw error;
  }
  return new Set(output.toString('utf8').split('\0').filter(Boolean));
}

function nothingMatched(error: unknown) {
  if (!(error instanceof GitCommandError)) return false;
  const cause = error.cause;
  return (
    cause instanceof Error &&
    'code' in cause &&
    (cause as { code: unknown }).code === 1
  );
}
