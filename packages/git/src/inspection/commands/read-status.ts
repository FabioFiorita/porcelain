import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type { GitStatusObservation } from '../dtos/git-status.ts';
import { InspectionLimitError } from '../errors/inspection-limit-error.ts';
import type { CheckoutSession } from '../interfaces/git-session.ts';
import { parseGitStatus } from '../parsers/parse-git-status.ts';
import { sessionConversionFilters } from './check-conversion-filters.ts';
import { runInspection } from './run-inspection.ts';

export async function readStatus(
  session: CheckoutSession,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<GitStatusObservation> {
  const config = await sessionConversionFilters(session, limits, signal);
  const output = await runInspection(
    session.path,
    [
      'status',
      '--porcelain=v2',
      '-z',
      '--branch',
      '--ahead-behind',
      '--untracked-files=all',
      '--ignore-submodules=dirty',
      '--find-renames=50%',
    ],
    limits,
    signal,
    { maxBytes: limits.inspection.statusBytes, config },
  );
  const status = parseGitStatus(output, limits);
  if (status.changes.length > limits.inspection.maxChanges)
    throw new InspectionLimitError();
  return status;
}
