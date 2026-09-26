import {
  readChangeDiffsRequestSchema,
  readChangeDiffsResponseSchema,
  readChangeLinesResponseSchema,
  readChangesResponseSchema,
  readGitStatusResponseSchema,
  type ReadChangeDiffsRequest,
} from '@porcelain/contracts/changes';
import { RequestError, requestJson } from '@/shared/api/request';
import { browserTransport } from '@/shared/api/transport';

function createChangesApi(transport: typeof fetch) {
  const worktreePath = (worktreeId: string) =>
    `/api/worktrees/${encodeURIComponent(worktreeId)}`;
  return {
    list: (signal: AbortSignal, worktreeId: string) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/changes`,
        readChangesResponseSchema,
        { signal },
      ),
    diffs: (
      signal: AbortSignal,
      worktreeId: string,
      input: ReadChangeDiffsRequest,
    ) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/changes/diffs`,
        readChangeDiffsResponseSchema,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(readChangeDiffsRequestSchema.encode(input)),
          signal,
        },
      ),
    lines: (
      signal: AbortSignal,
      worktreeId: string,
      path: string,
      from: number,
      to: number,
      at: 'head' | 'worktree',
    ) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/changes/lines?${new URLSearchParams({ path, from: String(from), to: String(to), at })}`,
        readChangeLinesResponseSchema,
        { signal },
      ),
    status: (signal: AbortSignal, worktreeId: string) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/git/status`,
        readGitStatusResponseSchema,
        { signal },
      ),
  };
}

export const changesApi = createChangesApi(browserTransport(fetch));

export function isWorktreeChangedError(error: unknown) {
  return (
    error instanceof RequestError &&
    error.status === 409 &&
    error.code === 'worktree_changed'
  );
}
