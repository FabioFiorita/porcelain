import { executeInspection } from '../execute-inspection.ts';
import { parseGitStatus } from '../mappers/parse-git-status.ts';
import { checkConversionFilters } from './check-conversion-filters.ts';

export async function readStatus(checkout: string, signal?: AbortSignal) {
  const config = await checkConversionFilters(checkout, signal);
  const output = await executeInspection(
    checkout,
    [
      'status',
      '--porcelain=v2',
      '-z',
      '--branch',
      '--no-ahead-behind',
      '--untracked-files=all',
      '--ignore-submodules=dirty',
      '--find-renames=50%',
    ],
    8 * 1024 * 1024,
    signal,
    config,
  );
  await checkConversionFilters(checkout, signal);
  return parseGitStatus(output);
}
