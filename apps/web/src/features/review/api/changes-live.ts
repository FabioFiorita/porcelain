import {
  readChangeDiffsRequestSchema,
  readChangeDiffsResponseSchema,
  readChangeLinesResponseSchema,
  readChangesResponseSchema,
  readGitStatusResponseSchema,
} from '@porcelain/contracts/changes';
import { requestJson } from '@/shared/api/request';
import type { ReviewPort } from './review-port';
import { jsonBody, queryString, worktreePath } from './review-request';

export function createChangesLive(
  transport: typeof fetch,
): Pick<ReviewPort, 'changes' | 'diffs' | 'lines' | 'status'> {
  return {
    changes: async ({ worktreeId, signal }) => ({
      changes: await requestJson(
        transport,
        `${worktreePath(worktreeId)}/changes`,
        readChangesResponseSchema,
        { signal },
      ),
    }),
    diffs: ({ worktreeId, signal, input }) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/changes/diffs`,
        readChangeDiffsResponseSchema,
        {
          method: 'POST',
          ...jsonBody(readChangeDiffsRequestSchema.encode(input)),
          signal,
        },
      ),
    lines: ({ worktreeId, signal, path, from, to, at }) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/changes/lines${queryString({ path, from, to, at })}`,
        readChangeLinesResponseSchema,
        { signal },
      ),
    status: ({ worktreeId, signal }) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/git/status`,
        readGitStatusResponseSchema,
        { signal },
      ),
  };
}
