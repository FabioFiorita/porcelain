import { executeInspection } from '../execute-inspection.ts';
import { parseGitStatus } from '../mappers/parse-git-status.ts';

export async function readStatus(checkout: string, signal?: AbortSignal) {
  const output = await executeInspection(
    checkout,
    [
      'status',
      '--porcelain=v2',
      '-z',
      '--branch',
      '--no-ahead-behind',
      '--untracked-files=all',
      '--ignore-submodules=none',
      '--find-renames=50%',
    ],
    8 * 1024 * 1024,
    signal,
  );
  return parseGitStatus(output);
}
