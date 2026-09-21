import type { GitStatusResponse } from '@porcelain/contracts/git-status';
import type { Application } from '../../application.ts';

export function toGitStatusResponse(
  result: Awaited<ReturnType<Application['gitStatus']>>,
): GitStatusResponse {
  return {
    environmentId: result.environmentId,
    worktreeId: result.worktreeId,
    statusToken: result.status.statusToken,
    headOid: result.status.headOid,
    inProgress: result.status.inProgress ?? null,
    mergeHeadOid: result.status.mergeHeadOid ?? null,
    headCommit: result.status.headCommit ?? null,
    ...(result.status.branch ? { branch: result.status.branch } : {}),
    consistency: 'best-effort',
    changes: result.status.changes.map((change) => {
      if (change.scope === 'untracked')
        return { scope: change.scope, path: change.path };
      if (change.scope === 'unmerged')
        return {
          scope: change.scope,
          path: change.path,
          conflict: change.conflict,
        };
      return {
        scope: change.scope,
        kind: change.kind,
        oldPath: change.oldPath,
        newPath: change.newPath,
        oldMode: change.oldMode,
        newMode: change.newMode,
        oldOid: change.oldOid,
        newOid: change.newOid,
        supported: change.supported,
      };
    }),
  };
}
