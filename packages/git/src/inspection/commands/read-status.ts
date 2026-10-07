import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { InspectionLimitError } from '../../shared/errors/inspection-limit-error.ts';
import type { EffectCheckoutSession } from '../interfaces/git-session.ts';
import { parseGitStatusEffect } from '../parsers/parse-git-status.ts';
import { sessionConversionFilters } from './check-conversion-filters.ts';
import { runInspection } from './run-inspection.ts';

export const readStatus = Effect.fn('Git.readStatus')(function* (
  session: EffectCheckoutSession,
  limits: GitLimits,
) {
  const config = yield* sessionConversionFilters(session, limits);
  const output = yield* runInspection(
    session.path,
    [
      'status',
      '--porcelain=v2',
      '-z',
      '--branch',
      '--ahead-behind',
      '--untracked-files=all',
      '--ignore-submodules=dirty',
      `--find-renames=${limits.renames.similarityPercent}%`,
    ],
    limits,
    { maxBytes: limits.inspection.statusBytes, config },
  );
  const status = yield* parseGitStatusEffect(output, limits);
  if (status.changes.length > limits.inspection.maxChanges)
    return yield* Effect.fail(new InspectionLimitError());
  return status;
});
