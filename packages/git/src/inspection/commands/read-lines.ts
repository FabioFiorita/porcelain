import type { LineRange } from '../dtos/line-range.ts';
import type { CheckoutSession } from '../interfaces/git-session.ts';
import { runInspection } from './run-inspection.ts';

export async function readLines(
  session: CheckoutSession,
  range: Omit<LineRange, 'at'>,
  signal?: AbortSignal,
): Promise<string[]> {
  const output = await runInspection(
    session.path,
    ['show', `HEAD:${range.path}`],
    signal,
    { maxBytes: 1024 * 1024 },
  );
  signal?.throwIfAborted();
  return output.toString('utf8').split('\n');
}
