import { UnsupportedPathEncodingError } from '../errors/unsupported-path-encoding-error.ts';
import { runInspection } from '../read-inspection.ts';

/**
 * Every path quick open can offer, in one Git process.
 *
 * It is bounded twice over, because one process is not the same as a bounded
 * answer: `ls-files` is O(repository) whatever it costs to start, and a
 * monorepo can answer with megabytes before anybody has typed. The byte cap
 * stops the decode, and the count cap stops the response — and when either is
 * hit the caller is told the list is too large rather than handed a truncated
 * one that looks complete.
 *
 * The decode is fatal on purpose. Replacing invalid bytes would map a raw
 * `0xff` name and a real U+FFFD name onto the same string, and quick open
 * would then offer one file and open the other.
 */
export const MAX_QUICK_OPEN_BYTES = 4 * 1024 * 1024;
/** What the whole-tree read allowed, so nothing became unsearchable. */
export const MAX_QUICK_OPEN_PATHS = 50_000;

export async function listTrackedPaths(
  checkout: string,
  signal?: AbortSignal,
): Promise<{ paths: string[]; complete: boolean }> {
  const output = await runInspection(
    checkout,
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    signal,
    { maxBytes: MAX_QUICK_OPEN_BYTES },
  );
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      output,
    );
  } catch (cause) {
    throw new UnsupportedPathEncodingError({ cause });
  }
  const paths = decoded.split('\0').filter(Boolean);
  return paths.length > MAX_QUICK_OPEN_PATHS
    ? { paths: [], complete: false }
    : { paths: paths.sort(), complete: true };
}
