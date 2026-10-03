import {
  readChangesEndpoint,
  readChangeDiffsEndpoint,
  readChangeLinesEndpoint,
  readBranchChangesEndpoint,
  readBranchDiffsEndpoint,
  listBranchBasesEndpoint,
  readCommitDiffsEndpoint,
  readGitStatusEndpoint,
} from '@porcelain/contracts/changes';
import {
  type ReadBranchDiffsRequest,
  type ReadChangeDiffsRequest,
} from '@porcelain/contracts/changes';
import { requestEndpoint } from '../../shared/api/request.ts';
import { perConnection } from '../../shared/api/per-connection.ts';
import { type Transport } from '../../shared/api/transport.ts';

function createChangesApi(transport: Transport) {
  return {
    list: ({
      signal,
      worktreeId,
    }: {
      signal: AbortSignal;
      worktreeId: string;
    }) =>
      requestEndpoint(transport, readChangesEndpoint, {
        params: { worktreeId },
        signal,
      }),
    diffs: ({
      signal,
      worktreeId,
      input,
    }: {
      signal: AbortSignal;
      worktreeId: string;
      input: ReadChangeDiffsRequest;
    }) =>
      requestEndpoint(transport, readChangeDiffsEndpoint, {
        params: { worktreeId },
        body: input,
        signal,
      }),
    lines: ({
      signal,
      worktreeId,
      path,
      from,
      to,
      at,
    }: {
      signal: AbortSignal;
      worktreeId: string;
      path: string;
      from: number;
      to: number;
      at: 'head' | 'worktree';
    }) =>
      requestEndpoint(transport, readChangeLinesEndpoint, {
        params: { worktreeId },
        query: { path, from, to, at },
        signal,
      }),
    branch: ({
      signal,
      worktreeId,
      base,
    }: {
      signal: AbortSignal;
      worktreeId: string;
      base?: string | undefined;
    }) =>
      requestEndpoint(transport, readBranchChangesEndpoint, {
        params: { worktreeId },
        query: { base },
        signal,
      }),
    branchDiffs: ({
      signal,
      worktreeId,
      input,
    }: {
      signal: AbortSignal;
      worktreeId: string;
      input: ReadBranchDiffsRequest;
    }) =>
      requestEndpoint(transport, readBranchDiffsEndpoint, {
        params: { worktreeId },
        body: input,
        signal,
      }),
    branchBases: ({
      signal,
      worktreeId,
    }: {
      signal: AbortSignal;
      worktreeId: string;
    }) =>
      requestEndpoint(transport, listBranchBasesEndpoint, {
        params: { worktreeId },
        signal,
      }),
    commitDiffs: ({
      signal,
      worktreeId,
      oid,
      parent,
      paths,
    }: {
      signal: AbortSignal;
      worktreeId: string;
      oid: string;
      parent: number;
      paths: string[][];
    }) =>
      requestEndpoint(transport, readCommitDiffsEndpoint, {
        params: { worktreeId, oid },
        body: {
          ...(parent === 1 ? {} : { parent }),
          paths,
        },
        signal,
      }),
    status: ({
      signal,
      worktreeId,
    }: {
      signal: AbortSignal;
      worktreeId: string;
    }) =>
      requestEndpoint(transport, readGitStatusEndpoint, {
        params: { worktreeId },
        signal,
      }),
  };
}

export const changesApi = perConnection(createChangesApi);
