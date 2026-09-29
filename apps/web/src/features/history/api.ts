import {
  listCommitsResponseSchema,
  listFileCommitsResponseSchema,
  readCommitFilesResponseSchema,
} from '@porcelain/contracts/changes';
import { COMMITS_PER_PAGE } from '@porcelain/contracts/shared';
import { requestJson } from '@/shared/api/request';
import { browserTransport } from '@/shared/api/transport';

const transport = browserTransport(fetch);

const worktreePath = (worktreeId: string) =>
  `/api/worktrees/${encodeURIComponent(worktreeId)}/commits`;

export const historyApi = {
  list: (
    signal: AbortSignal,
    worktreeId: string,
    after?: string[],
    tip?: string,
  ) => {
    const parameters = new URLSearchParams();
    if (after) parameters.set('after', after.join(','));
    if (tip) parameters.set('tip', tip);
    const query = parameters.size === 0 ? '' : `?${parameters}`;
    return requestJson(
      transport,
      `${worktreePath(worktreeId)}${query}`,
      listCommitsResponseSchema,
      { signal },
    );
  },
  fileCommits: (signal: AbortSignal, worktreeId: string, path: string) =>
    requestJson(
      transport,
      `/api/worktrees/${encodeURIComponent(worktreeId)}/file-commits?${new URLSearchParams({ path, limit: String(COMMITS_PER_PAGE) })}`,
      listFileCommitsResponseSchema,
      { signal },
    ),
  commit: (
    signal: AbortSignal,
    worktreeId: string,
    oid: string,
    parent = 1,
  ) => {
    const parameters = new URLSearchParams();
    if (parent !== 1) parameters.set('parent', String(parent));
    const query = parameters.size === 0 ? '' : `?${parameters}`;
    return requestJson(
      transport,
      `${worktreePath(worktreeId)}/${encodeURIComponent(oid)}/files${query}`,
      readCommitFilesResponseSchema,
      { signal },
    );
  },
};
