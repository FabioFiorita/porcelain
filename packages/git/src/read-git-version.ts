import { runGitRead } from './run-git.ts';

let pending: Promise<Buffer> | undefined;

/**
 * The Git version, read once for the life of the process. It cannot change
 * under a running server without the executable being replaced, so reading it
 * per request bought nothing. The history snapshot token still mixes it with a
 * freshly read shallow boundary, so that check is unaffected.
 *
 * `git --version` needs no repository, so the working directory is enough.
 */
export function readGitVersion(): Promise<Buffer> {
  pending ??= runGitRead(process.cwd(), ['--version']).catch(
    (cause: unknown) => {
      // A failed read is not remembered, so a later request can try again and
      // a missing Git still surfaces per request rather than at startup.
      pending = undefined;
      throw cause;
    },
  );
  return pending;
}
