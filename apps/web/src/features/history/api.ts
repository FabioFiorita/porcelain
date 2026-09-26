import {
  listCommitsResponseSchema,
  readCommitDiffsRequestSchema,
  readCommitDiffsResponseSchema,
  readCommitFilesResponseSchema,
} from '@porcelain/contracts/changes';
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
  diffs: (
    signal: AbortSignal,
    worktreeId: string,
    oid: string,
    parent: number,
    paths: string[][],
  ) =>
    requestJson(
      transport,
      `${worktreePath(worktreeId)}/${encodeURIComponent(oid)}/diffs`,
      readCommitDiffsResponseSchema,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          readCommitDiffsRequestSchema.parse({
            ...(parent === 1 ? {} : { parent }),
            paths,
          }),
        ),
        signal,
      },
    ),
};
