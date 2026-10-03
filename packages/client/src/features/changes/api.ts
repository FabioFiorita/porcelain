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
import {
  requestEndpoint,
  type EndpointArguments,
} from '../../shared/api/request.ts';
import { perConnection } from '../../shared/api/per-connection.ts';
import { type Transport } from '../../shared/api/transport.ts';

function createChangesApi(transport: Transport) {
  return {
    list: ({
      signal,
      worktreeId,
    }: EndpointArguments<typeof readChangesEndpoint>) =>
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
    }: EndpointArguments<typeof readChangeLinesEndpoint>) =>
      requestEndpoint(transport, readChangeLinesEndpoint, {
        params: { worktreeId },
        query: { path, from, to, at },
        signal,
      }),
    branch: ({
      signal,
      worktreeId,
      base,
    }: EndpointArguments<typeof readBranchChangesEndpoint>) =>
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
    }: EndpointArguments<typeof listBranchBasesEndpoint>) =>
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
    }: EndpointArguments<typeof readGitStatusEndpoint>) =>
      requestEndpoint(transport, readGitStatusEndpoint, {
        params: { worktreeId },
        signal,
      }),
  };
}

export const changesApi = perConnection(createChangesApi);
