import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { runInspection } from './run-inspection.ts';

export type BranchTracking = {
  remoteName: string | null;
  sourceRef: string | null;
  upstream: string | null;
};

export async function readBranchTracking(
  checkout: string,
  branch: string,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<BranchTracking | undefined> {
  const output = await runInspection(
    checkout,
    [
      'for-each-ref',
      '--format=%(refname)%00%(upstream:remotename)%00%(upstream:remoteref)%00%(upstream)',
      'refs/heads/',
    ],
    limits,
    signal,
    { maxBytes: limits.inspection.branchTrackingBytes },
  );
  const fields = output
    .toString('utf8')
    .split('\n')
    .map((line) => line.split('\0'))
    .find(([name]) => name === `refs/heads/${branch}`);
  if (fields === undefined) return undefined;
  const [, remoteName, sourceRef, upstream] = fields;
  return {
    remoteName: remoteName || null,
    sourceRef: sourceRef || null,
    upstream: upstream || null,
  };
}
