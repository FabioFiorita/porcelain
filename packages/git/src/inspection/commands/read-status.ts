import type { GitStatusObservation } from '../dtos/git-status.ts';
import { InspectionLimitError } from '../errors/inspection-limit-error.ts';
import type { CheckoutSession } from '../interfaces/git-session.ts';
import { parseGitStatus } from '../parsers/parse-git-status.ts';
import { sessionConversionFilters } from './check-conversion-filters.ts';
import { runInspection } from './run-inspection.ts';

const MAX_CHANGES = 2000;

export async function readStatus(
  session: CheckoutSession,
  signal?: AbortSignal,
): Promise<GitStatusObservation> {
  const config = await sessionConversionFilters(session, signal);
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
    signal,
    { maxBytes: 8 * 1024 * 1024, config },
  );
  const status = parseGitStatus(output);
  if (status.changes.length > MAX_CHANGES) throw new InspectionLimitError();
  return status;
}
