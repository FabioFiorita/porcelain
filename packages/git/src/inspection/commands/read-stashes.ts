import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { parseStashList, STASH_LIST_ARGS } from '../../shared/parsers/refs.ts';
import { runInspection } from './run-inspection.ts';

export const readStashes = Effect.fn('Git.readStashes')(function* (
  checkout: string,
  limits: GitLimits,
) {
  const output = yield* runInspection(
    checkout,
    [...STASH_LIST_ARGS, `--max-count=${limits.inspection.maxStashes}`],
    limits,
    { maxBytes: limits.inspection.stashListBytes },
  );
  return parseStashList(output.toString('utf8')).map(({ oid, message }) => ({
    oid,
    message,
  }));
});
