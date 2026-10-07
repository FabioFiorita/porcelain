import { Effect } from 'effect';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { runInspection } from './run-inspection.ts';

export const readBranchTracking = Effect.fn('Git.readBranchTracking')(
  function* (checkout: string, branch: string, limits: GitLimits) {
    const output = yield* runInspection(
      checkout,
      [
        'for-each-ref',
        '--format=%(refname)%00%(upstream:remotename)%00%(upstream:remoteref)%00%(upstream)',
        'refs/heads/',
      ],
      limits,
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
  },
);
