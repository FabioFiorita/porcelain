import { GitCommandError } from '../errors/git-command-error.ts';
import { runInspection } from '../read-inspection.ts';

/** A folder is at most a couple of thousand entries; its names are short. */
const MAX_OUTPUT_BYTES = 1024 * 1024;

/**
 * Which of these exact paths Git ignores, in one process.
 *
 * `check-ignore` answers about the paths it is handed and nothing else, so
 * opening a folder never descends into an ignored one to find out that it is
 * ignored — which is the whole reason a directory of a hundred thousand files
 * can be shown as one dimmed row.
 *
 * Exit status 1 means "none of them", which is an answer rather than a
 * failure; anything else is a failure and is raised.
 *
 * It takes a checkout path rather than a guarded session on purpose: the
 * caller is a file read, which establishes the worktree by stat before and
 * after and verifies the directory itself around this call. Adding the Git
 * identity guard here would spend two more processes to answer a question the
 * filesystem has already answered.
 */
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
        // `-z` makes the input NUL-separated too, which is the only way to
        // ask about a name containing a newline.
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
