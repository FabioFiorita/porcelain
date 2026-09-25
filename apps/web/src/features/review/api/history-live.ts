import {
  listCommitsResponseSchema,
  readCommitDiffsRequestSchema,
  readCommitDiffsResponseSchema,
  readCommitFilesResponseSchema,
} from '@porcelain/contracts/changes';
import { requestJson } from '@/shared/api/request';
import type { ReviewPort } from './review-port';
import { jsonBody, queryString, worktreePath } from './review-request';

export function createHistoryLive(
  transport: typeof fetch,
): Pick<ReviewPort, 'history' | 'commit' | 'commitDiffs'> {
  return {
    history: ({ worktreeId, signal, after, tip }) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/commits${queryString({ after: after?.join(','), tip })}`,
        listCommitsResponseSchema,
        { signal },
      ),
    commit: ({ worktreeId, signal, oid, parent }) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/commits/${encodeURIComponent(oid)}/files${queryString({ parent })}`,
        readCommitFilesResponseSchema,
        { signal },
      ),
    commitDiffs: ({ worktreeId, signal, oid, parent, paths }) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/commits/${encodeURIComponent(oid)}/diffs`,
        readCommitDiffsResponseSchema,
        {
          method: 'POST',
          ...jsonBody(readCommitDiffsRequestSchema.parse({ parent, paths })),
          signal,
        },
      ),
  };
}
