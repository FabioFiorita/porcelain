import { UnsupportedPathEncodingError } from '../errors/unsupported-path-encoding-error.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { runInspection } from './run-inspection.ts';

export async function listTrackedPaths(
  checkout: string,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<{ paths: string[]; complete: boolean }> {
  const output = await runInspection(
    checkout,
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    limits,
    signal,
    { maxBytes: limits.inspection.trackedPathsBytes },
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
  return paths.length > limits.inspection.maxTrackedPaths
    ? { paths: [], complete: false }
    : { paths: paths.sort(), complete: true };
}
