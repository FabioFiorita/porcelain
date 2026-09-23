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
    return false;
  }
}
