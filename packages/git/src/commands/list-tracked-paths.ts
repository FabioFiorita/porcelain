import { UnsupportedPathEncodingError } from '../errors/unsupported-path-encoding-error.ts';
import { runInspection } from '../read-inspection.ts';

export const MAX_QUICK_OPEN_BYTES = 4 * 1024 * 1024;
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
