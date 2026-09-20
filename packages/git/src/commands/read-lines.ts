import type { LineRange } from '../dtos/line-range.ts';
import type { CheckoutSession } from '../interfaces/git-session.ts';
import { runInspection } from '../read-inspection.ts';

/** A snippet is context beside a review, not a file read; keep it small. */
const MAX_SNIPPET_BYTES = 1024 * 1024;

/**
 * A range of lines from the last commit.
 *
 * Only `head` comes from Git. The file on disk is neither the revision that
 * was promised nor byte-identical to it under end-of-line or conversion
 * rules, so answering it from disk would be a different text under the same
 * name — and reading a working path is the filesystem's job, through the
 * boundary that refuses to follow a link out of the checkout.
 */
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
