import type { CheckoutSession } from '../interfaces/git-session.ts';
import { parseGitStatus } from '../mappers/parse-git-status.ts';
import { runInspection } from '../read-inspection.ts';
import { sessionConversionFilters } from './check-conversion-filters.ts';

export async function readStatus(
  session: CheckoutSession,
  signal?: AbortSignal,
) {
  const checkout = session.path;
  const config = await sessionConversionFilters(session, signal);
  const output = await runInspection(
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
    signal,
    { maxBytes: 8 * 1024 * 1024, config: config },
  );
  return parseGitStatus(output);
}

/**
 * The remote name, source ref and stashes the action UI needs.
 *
 * Two processes that say nothing about what changed, which is why they are not
 * part of reading the list of changes: opening a worktree pays for the list,
 * and only opening the action UI pays for these.
 */
export async function readBranchDetails(
  session: CheckoutSession,
  branch: string | null,
  signal?: AbortSignal,
): Promise<{
  remoteName: string | null;
  sourceRef: string | null;
  stashes: { oid: string; message: string }[];
}> {
  const checkout = session.path;
  const tracking = branch
    ? (
        await runInspection(
          checkout,
          [
            'for-each-ref',
            '--format=%(refname)%00%(upstream:remotename)%00%(upstream:remoteref)',
            'refs/heads/',
          ],
          signal,
          { maxBytes: 1024 * 1024 },
        )
      )
        .toString('utf8')
        .split('\n')
        .map((line) => line.split('\0'))
        .find(([name]) => name === `refs/heads/${branch}`)
    : undefined;
  const stashes = (
    await runInspection(
      checkout,
      ['stash', 'list', '--format=%H%x00%gs', '-100'],
      signal,
      { maxBytes: 1024 * 1024 },
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
  return {
    remoteName: tracking?.[1] || null,
    sourceRef: tracking?.[2] || null,
    stashes,
  };
}
