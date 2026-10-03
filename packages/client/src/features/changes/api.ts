import {
  listBranchBasesResponseSchema,
  readBranchChangesResponseSchema,
  readBranchDiffsRequestSchema,
  readBranchDiffsResponseSchema,
  readChangeDiffsRequestSchema,
  readChangeDiffsResponseSchema,
  readChangeLinesResponseSchema,
  readChangesResponseSchema,
  readCommitDiffsRequestSchema,
  readCommitDiffsResponseSchema,
  readGitStatusResponseSchema,
  type ReadBranchDiffsRequest,
  type ReadChangeDiffsRequest,
} from '@porcelain/contracts/changes';
import { RequestError, requestJson } from '../../shared/api/request.ts';
import { perConnection } from '../../shared/api/per-connection.ts';
import { type Transport } from '../../shared/api/transport.ts';

function createChangesApi(transport: Transport) {
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
        `${worktreePath(worktreeId)}/changes/lines?${new URLSearchParams({ path, from: String(from), to: String(to), at }).toString()}`,
        readChangeLinesResponseSchema,
        { signal },
      ),
    branch: (signal: AbortSignal, worktreeId: string, base?: string) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/branch-changes${base === undefined ? '' : `?${new URLSearchParams({ base }).toString()}`}`,
        readBranchChangesResponseSchema,
        { signal },
      ),
    branchDiffs: (
      signal: AbortSignal,
      worktreeId: string,
      input: ReadBranchDiffsRequest,
    ) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/branch-changes/diffs`,
        readBranchDiffsResponseSchema,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(readBranchDiffsRequestSchema.parse(input)),
          signal,
        },
      ),
    branchBases: (signal: AbortSignal, worktreeId: string) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/branch-bases`,
        listBranchBasesResponseSchema,
        { signal },
      ),
    commitDiffs: (
      signal: AbortSignal,
      worktreeId: string,
      oid: string,
      parent: number,
      paths: string[][],
    ) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/commits/${encodeURIComponent(oid)}/diffs`,
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
    status: (signal: AbortSignal, worktreeId: string) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/git/status`,
        readGitStatusResponseSchema,
        { signal },
      ),
  };
}

export const changesApi = perConnection(createChangesApi);

export function isWorktreeChangedError(error: unknown) {
  return (
    error instanceof RequestError &&
    error.status === 409 &&
    error.code === 'worktree_changed'
  );
}
