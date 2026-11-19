import type { LiveNotice } from '@porcelain/contracts/access';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import {
  fileSurfaces,
  gitSurfaces,
  queryKeys,
} from '../../../shared/api/query-keys.ts';
import { noticeSurfaces, receiptSurfaces } from '../rules/live-surfaces.ts';

const BRANCH_SURFACES = ['branch', 'branch-bases', 'history'];

function noticeReadSurfaces(notice: LiveNotice) {
  if (
    notice.type === 'ready' ||
    notice.type === 'subscribed' ||
    notice.type === 'heartbeat' ||
    notice.type === 'git-action'
  )
    return undefined;
  if (notice.type === 'inventory') return undefined;
  if (notice.type === 'project') return undefined;
  const surfaces = new Set(noticeSurfaces(notice)?.surfaces);
  if (notice.change === 'files')
    for (const surface of fileSurfaces) surfaces.add(surface);
  if (notice.change === 'git')
    for (const surface of [...gitSurfaces, ...BRANCH_SURFACES])
      surfaces.add(surface);
  return { scope: notice, surfaces };
}

export function noticeReadKeys(environmentId: string, notice: LiveNotice) {
  const read = noticeReadSurfaces(notice);
  return read
    ? [...read.surfaces].map((surface) =>
        queryKeys.reviewSurface(environmentId, read.scope, [surface]),
      )
    : [];
}

function receiptReadSurfaces(
  receipt: Pick<
    RunGitActionResponse,
    'projectId' | 'worktreeId' | 'action' | 'state'
  >,
) {
  if (
    receipt.state === 'running' ||
    receipt.state === 'rejected' ||
    receipt.state === 'no-change'
  )
    return undefined;
  return new Set([
    ...(receipt.action === 'fetch' || receipt.action === 'push'
      ? ['git-status', 'changes']
      : [...gitSurfaces, ...fileSurfaces]),
    ...BRANCH_SURFACES,
    ...(receiptSurfaces(receipt)?.surfaces ?? []),
  ]);
}

export function receiptReadKeys(
  environmentId: string,
  receipt: Pick<
    RunGitActionResponse,
    'projectId' | 'worktreeId' | 'action' | 'state'
  >,
) {
  const surfaces = receiptReadSurfaces(receipt);
  return surfaces
    ? [...surfaces].map((surface) =>
        queryKeys.reviewSurface(environmentId, receipt, [surface]),
      )
    : [];
}

export function liveReadKeys(environmentId: string, notice: LiveNotice) {
  switch (notice.type) {
    case 'ready':
      return [queryKeys.environment(environmentId)];
    case 'inventory':
      return notice.change === 'activity'
        ? [queryKeys.worktreeInventory(environmentId)]
        : [
            queryKeys.inventory(environmentId),
            queryKeys.reviewGitSettings(environmentId),
          ];
    case 'worktree':
      return [
        ...(notice.change === 'reviewed'
          ? []
          : [queryKeys.worktreeInventory(environmentId)]),
        ...(notice.change === 'git'
          ? [queryKeys.projectPullRequests(environmentId, notice.projectId)]
          : []),
        ...noticeReadKeys(environmentId, notice),
      ];
    case 'project':
      return notice.change === 'preferences'
        ? [queryKeys.filePreferences(environmentId, notice.projectId)]
        : [];
    default:
      return noticeReadKeys(environmentId, notice);
  }
}
