import type { LiveNotice } from '@porcelain/contracts/access';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import {
  fileSurfaces,
  gitSurfaces,
  queryKeys,
} from '../../../shared/api/query-keys.ts';
import {
  noticeSurfaces,
  receiptSurfaces,
} from '../../reviews/rules/live-surfaces.ts';

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
