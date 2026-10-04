import {
  listCommitModelsEndpoint,
  generateCommitDraftEndpoint,
  runGitActionEndpoint,
  dismissInterruptedGitActionEndpoint,
  readGitActionReceiptEndpoint,
} from '@porcelain/contracts/git-actions';

import { RequestError, requestEndpoint } from '../../shared/api/request.ts';

import type { GitActionsPort } from './ports/git-actions.ts';
import { perConnection } from '../../shared/api/per-connection.ts';
import type { Transport } from '../../shared/api/transport.ts';

function createGitActionsApi(transport: Transport): GitActionsPort {
  return {
    models: ({ signal }) =>
      requestEndpoint(transport, listCommitModelsEndpoint, { signal }),
    draft: ({ worktreeId, signal, input }) =>
      requestEndpoint(transport, generateCommitDraftEndpoint, {
        params: { worktreeId },
        body: input,
        signal,
      }),
    run: async ({ worktreeId, signal, input }) => {
      const result = await requestEndpoint(transport, runGitActionEndpoint, {
        params: { worktreeId },
        body: input,
        signal,
      });
      if ('requestId' in result) return result;
      throw new RequestError(result.statusCode, result.message);
    },
    dismissInterrupted: async ({ worktreeId, requestId, signal }) => {
      await requestEndpoint(transport, dismissInterruptedGitActionEndpoint, {
        params: { worktreeId, requestId },
        signal,
      });
    },
    receipt: ({ worktreeId, requestId, signal }) =>
      requestEndpoint(transport, readGitActionReceiptEndpoint, {
        params: { worktreeId, requestId },
        signal,
      }),
  };
}

export const gitActionsApi = perConnection(createGitActionsApi);
