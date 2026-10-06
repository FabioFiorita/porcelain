import type { LiveNotice } from '@porcelain/contracts/access';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';

const PUBLISHED = ['review', 'reviewed-layers'];
const CHANGE_SURFACES = {
  files: PUBLISHED,
  git: PUBLISHED,
  review: PUBLISHED,
  reviewed: ['reviewed', 'reviewed-layers'],
  comments: ['comments'],
} as const;

export function noticeSurfaces(notice: LiveNotice) {
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
    surfaces: new Set<string>(PUBLISHED),
  };
}
