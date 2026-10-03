import {
  dismissInterruptedGitActionResponseSchema,
  generateCommitDraftRequestSchema,
  generateCommitDraftResponseSchema,
  listCommitModelsResponseSchema,
  readGitActionReceiptResponseSchema,
  runGitActionRejectedResponseSchema,
  runGitActionRequestSchema,
} from '@porcelain/contracts/git-actions';
import { RequestError, requestJson } from '@porcelain/client/transport';
import { GIT_ACTION_REJECTED_STATUSES } from '@/config/limits';
import type { GitActionsPort } from './rules/git-action';
import { perConnection } from '@porcelain/client/transport';
import type { Transport } from '@porcelain/client/transport';

function createGitActionsApi(transport: Transport): GitActionsPort {
  const path = (worktreeId: string) =>
    `/api/worktrees/${encodeURIComponent(worktreeId)}/git`;
  const json = (body: unknown) => ({
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    models: ({ signal }) =>
      requestJson(
        transport,
        '/api/git/commit-models',
        listCommitModelsResponseSchema,
        { signal },
      ),
    draft: ({ worktreeId, signal, input }) =>
      requestJson(
        transport,
        `${path(worktreeId)}/commit-draft`,
        generateCommitDraftResponseSchema,
        {
          method: 'POST',
          ...json(generateCommitDraftRequestSchema.parse(input)),
          signal,
        },
      ),
    run: async ({ worktreeId, signal, input }) => {
      const result = await requestJson(
        transport,
        `${path(worktreeId)}/actions`,
        runGitActionRejectedResponseSchema,
        {
          method: 'POST',
          ...json(runGitActionRequestSchema.encode(input)),
          signal,
        },
        GIT_ACTION_REJECTED_STATUSES,
      );
      if ('requestId' in result) return result;
      throw new RequestError(result.statusCode, result.message);
    },
    dismissInterrupted: async ({ worktreeId, requestId, signal }) => {
      await requestJson(
        transport,
        `${path(worktreeId)}/interrupted/${encodeURIComponent(requestId)}`,
        dismissInterruptedGitActionResponseSchema,
        { method: 'DELETE', signal },
      );
    },
    receipt: ({ worktreeId, requestId, signal }) =>
      requestJson(
        transport,
        `${path(worktreeId)}/receipts/${encodeURIComponent(requestId)}`,
        readGitActionReceiptResponseSchema,
        { signal },
      ),
  };
}

export const gitActionsApi = perConnection(createGitActionsApi);
