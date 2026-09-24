import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { parseStashList, STASH_LIST_ARGS } from '../../shared/refs.ts';
import { runInspection } from './run-inspection.ts';

export async function readStashes(
  checkout: string,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<{ oid: string; message: string }[]> {
  const output = await runInspection(
    checkout,
    [...STASH_LIST_ARGS, '-100'],
    limits,
    signal,
    { maxBytes: limits.inspection.stashListBytes },
  );
  return parseStashList(output.toString('utf8')).map(({ oid, message }) => ({
    oid,
    message,
  }));
}
