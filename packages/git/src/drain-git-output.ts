import type { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

export async function drainGitOutput(
  stdout: Readable,
  stderr: Readable,
  signal: AbortSignal,
): Promise<boolean> {
  try {
    await Promise.all([
      finished(stdout, { signal, cleanup: true }),
      finished(stderr, { signal, cleanup: true }),
    ]);
    return true;
  } catch {
    // An escaped descendant may still own a pipe. Never turn its partial output
    // into a successful result or let it keep the application queue forever.
    return false;
  }
}
