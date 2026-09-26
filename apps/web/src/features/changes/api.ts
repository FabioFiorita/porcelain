import {
  readChangeDiffsRequestSchema,
  readChangeDiffsResponseSchema,
  readChangeLinesResponseSchema,
  readChangesResponseSchema,
  readCommitDiffsRequestSchema,
  readCommitDiffsResponseSchema,
  readCommitFilesResponseSchema,
  readGitStatusResponseSchema,
  type ReadChangeDiffsRequest,
  type ReadCommitDiffsRequest,
} from '@porcelain/contracts/changes';
import { RequestError, requestJson } from '@/shared/api/request';
import { browserTransport } from '@/shared/api/transport';

function createChangesApi(transport: typeof fetch) {
  const worktreePath = (worktreeId: string) =>
    `/api/worktrees/${encodeURIComponent(worktreeId)}`;
  const commitPath = (worktreeId: string, oid: string) =>
    `${worktreePath(worktreeId)}/commits/${encodeURIComponent(oid)}`;
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
    commit: (
      signal: AbortSignal,
      worktreeId: string,
      oid: string,
      parent: number,
    ) =>
      requestJson(
        transport,
        `${commitPath(worktreeId, oid)}/files?${new URLSearchParams({ parent: String(parent) })}`,
        readCommitFilesResponseSchema,
        { signal },
      ),
    commitDiffs: (
      signal: AbortSignal,
      worktreeId: string,
      oid: string,
      input: ReadCommitDiffsRequest,
    ) =>
      requestJson(
        transport,
        `${commitPath(worktreeId, oid)}/diffs`,
        readCommitDiffsResponseSchema,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(readCommitDiffsRequestSchema.parse(input)),
          signal,
        },
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
