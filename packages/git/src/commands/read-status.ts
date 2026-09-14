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
      '--ahead-behind',
      '--untracked-files=all',
      '--ignore-submodules=dirty',
      '--find-renames=50%',
    ],
    8 * 1024 * 1024,
    signal,
    config,
  );
  await checkConversionFilters(checkout, signal);
  const status = parseGitStatus(output);
  if (status.branch) {
    const tracking = (
      await executeInspection(
        checkout,
        [
          'for-each-ref',
          '--format=%(refname)%00%(upstream:remotename)%00%(upstream:remoteref)',
          'refs/heads/',
        ],
        1024 * 1024,
        signal,
      )
    )
      .toString('utf8')
      .split('\n')
      .map((line) => line.split('\0'))
      .find(([name]) => name === `refs/heads/${status.branch?.name}`);
    const stashes = (
      await executeInspection(
        checkout,
        ['stash', 'list', '--format=%H%x00%gs', '-100'],
        1024 * 1024,
        signal,
      )
    )
      .toString('utf8')
      .trimEnd()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [oid = '', message = ''] = line.split('\0');
        return { oid, message };
      });
    status.branch = {
      ...status.branch,
      remoteName: tracking?.[1] || null,
      sourceRef: tracking?.[2] || null,
      stashes,
    };
  }
  return status;
}
