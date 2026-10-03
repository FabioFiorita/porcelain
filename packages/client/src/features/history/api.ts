import {
  listCommitsEndpoint,
  listFileCommitsEndpoint,
  readCommitFilesEndpoint,
} from '@porcelain/contracts/changes';

import { COMMITS_PER_PAGE } from '@porcelain/contracts/shared';
import { requestEndpoint } from '../../shared/api/request.ts';
import { perConnection } from '../../shared/api/per-connection.ts';
import { type Transport } from '../../shared/api/transport.ts';

function createHistoryApi(transport: Transport) {
  return {
    list: ({
      signal,
      worktreeId,
      after,
      tip,
    }: {
      signal: AbortSignal;
      worktreeId: string;
      after?: string[] | undefined;
      tip?: string | undefined;
    }) =>
      requestEndpoint(transport, listCommitsEndpoint, {
        params: { worktreeId },
        query: { after, tip },
        signal,
      }),
    fileCommits: ({
      signal,
      worktreeId,
      path,
    }: {
      signal: AbortSignal;
      worktreeId: string;
      path: string;
    }) =>
      requestEndpoint(transport, listFileCommitsEndpoint, {
        params: { worktreeId },
        query: { path, limit: COMMITS_PER_PAGE },
        signal,
      }),
    commit: ({
      signal,
      worktreeId,
      oid,
      parent = 1,
    }: {
      signal: AbortSignal;
      worktreeId: string;
      oid: string;
      parent?: number;
    }) =>
      requestEndpoint(transport, readCommitFilesEndpoint, {
        params: { worktreeId, oid },
        query: { parent },
        signal,
      }),
  };
}

export const historyApi = perConnection(createHistoryApi);
