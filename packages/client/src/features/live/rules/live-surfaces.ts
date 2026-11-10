import type { LiveNotice } from '@porcelain/contracts/access';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';

const WITH_WALKTHROUGH = ['walkthrough', 'walkthrough-conversations'];
const CHANGE_SURFACES = {
  files: ['walkthrough'],
  git: WITH_WALKTHROUGH,
  reviewed: ['reviewed'],
} as const;

export function noticeSurfaces(notice: LiveNotice) {
  if (notice.type === 'walkthrough')
    return {
      scope: { projectId: notice.projectId, worktreeId: notice.worktreeId },
      surfaces: new Set<string>(
        notice.change === 'run'
          ? ['walkthrough', 'walkthrough-conversations']
          : ['walkthrough-conversations'],
      ),
    };
  if (notice.type !== 'worktree') return null;
  return {
    scope: { projectId: notice.projectId, worktreeId: notice.worktreeId },
    surfaces: new Set<string>(CHANGE_SURFACES[notice.change]),
  };
}

export function receiptSurfaces(
  receipt: Pick<RunGitActionResponse, 'action' | 'projectId' | 'worktreeId'>,
) {
  if (receipt.action === 'fetch' || receipt.action === 'push') return null;
  return {
    scope: { projectId: receipt.projectId, worktreeId: receipt.worktreeId },
    surfaces: new Set<string>(WITH_WALKTHROUGH),
  };
}
