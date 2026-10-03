import {
  listCommitModelsEndpoint,
  generateCommitDraftEndpoint,
  runGitActionEndpoint,
  dismissInterruptedGitActionEndpoint,
  readGitActionReceiptEndpoint,
} from '@porcelain/contracts/git-actions';

import { RequestError, requestEndpoint } from '@porcelain/client/transport';

import type { GitActionsPort } from './rules/git-action';
import { perConnection } from '@porcelain/client/transport';
import type { Transport } from '@porcelain/client/transport';

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
