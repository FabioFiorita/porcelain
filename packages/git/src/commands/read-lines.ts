import type { LineRange } from '../dtos/line-range.ts';
import type { CheckoutSession } from '../interfaces/git-session.ts';
import { runInspection } from '../read-inspection.ts';

const MAX_SNIPPET_BYTES = 1024 * 1024;

export async function readLines(
  session: CheckoutSession,
  range: Omit<LineRange, 'at'>,
  signal?: AbortSignal,
): Promise<string[]> {
  const output = await runInspection(
    session.path,
    ['show', `HEAD:${range.path}`],
    signal,
    { maxBytes: MAX_SNIPPET_BYTES },
  );
  signal?.throwIfAborted();
  return output.toString('utf8').split('\n');
}
