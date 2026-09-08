import type { GitDiffResponse } from '@porcelain/contracts/git-diff';
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
        supported: change.supported,
      };
    }),
  };
}

export function toGitDiffResponse(
  result: Awaited<ReturnType<Application['gitDiff']>>,
): GitDiffResponse {
  return {
    environmentId: result.environmentId,
    worktreeId: result.worktreeId,
    statusToken: result.statusToken,
    consistency: 'best-effort',
    change: {
      scope: result.change.scope,
      oldPath: result.change.oldPath,
      newPath: result.change.newPath,
    },
    oldMode: result.change.oldMode,
    newMode: result.change.newMode,
    content: result.content,
  };
}
