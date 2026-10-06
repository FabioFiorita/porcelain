import type { LiveNotice } from '@porcelain/contracts/access';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import type { QueryFilters } from '@tanstack/query-core';
import {
  fileSurfaces,
  gitSurfaces,
  reviewSurfaceFilters,
} from '../../../shared/api/query-keys.ts';
import {
  noticeSurfaces,
  receiptSurfaces,
} from '../../reviews/rules/live-surfaces.ts';

const BRANCH_SURFACES = ['branch', 'branch-bases', 'history'];

export function noticeQueryFilters(
  environmentId: string,
  notice: LiveNotice,
): QueryFilters[] {
  if (
    notice.type === 'ready' ||
    notice.type === 'subscribed' ||
    notice.type === 'heartbeat' ||
    notice.type === 'git-action'
  )
    return [];
  if (notice.type === 'inventory') return [];
  if (notice.type === 'project') return [];
  const surfaces = new Set(noticeSurfaces(notice)?.surfaces);
  if (notice.change === 'files')
    for (const surface of fileSurfaces) surfaces.add(surface);
  if (notice.change === 'git')
    for (const surface of [...gitSurfaces, ...BRANCH_SURFACES])
      surfaces.add(surface);
  return [reviewSurfaceFilters(environmentId, notice, surfaces)];
}

export function receiptQueryFilters(
  environmentId: string,
  receipt: RunGitActionResponse,
): QueryFilters[] {
  if (
    receipt.state === 'running' ||
    receipt.state === 'rejected' ||
    receipt.state === 'no-change'
  )
    return [];
  const surfaces = new Set([
    ...(receipt.action === 'fetch' || receipt.action === 'push'
      ? ['git-status', 'changes']
      : [...gitSurfaces, ...fileSurfaces]),
    ...BRANCH_SURFACES,
    ...(receiptSurfaces(receipt)?.surfaces ?? []),
  ]);
  return [reviewSurfaceFilters(environmentId, receipt, surfaces)];
}
