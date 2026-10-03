import { defineEndpoint } from '../shared/endpoint.ts';
import { worktreeParamsSchema } from '../shared/worktree-params.ts';
import {
  generateCommitDraftRequestSchema,
  generateCommitDraftResponseSchema,
  listCommitModelsResponseSchema,
} from './commit-draft.ts';
import {
  dismissInterruptedGitActionParamsSchema,
  dismissInterruptedGitActionResponseSchema,
  readGitActionReceiptParamsSchema,
  readGitActionReceiptResponseSchema,
  runGitActionRejectedResponseSchema,
  runGitActionRequestSchema,
  runGitActionResponseSchema,
} from './git-actions.ts';

export const dismissInterruptedGitActionEndpoint = defineEndpoint({
  method: 'DELETE',
  path: '/worktrees/:worktreeId/git/interrupted/:requestId',
  schema: {
    params: dismissInterruptedGitActionParamsSchema,
    response: {
      200: dismissInterruptedGitActionResponseSchema,
    },
  },
  errors: [],
});

export const generateCommitDraftEndpoint = defineEndpoint({
  method: 'POST',
  path: '/worktrees/:worktreeId/git/commit-draft',
  schema: {
    params: worktreeParamsSchema,
    body: generateCommitDraftRequestSchema,
    response: { 200: generateCommitDraftResponseSchema },
  },
  errors: ['worktree_changed'],
});

export const listCommitModelsEndpoint = defineEndpoint({
  method: 'GET',
  path: '/git/commit-models',
  schema: {
    response: { 200: listCommitModelsResponseSchema },
  },
  errors: [],
});

export const readGitActionReceiptEndpoint = defineEndpoint({
  method: 'GET',
  path: '/worktrees/:worktreeId/git/receipts/:requestId',
  schema: {
    params: readGitActionReceiptParamsSchema,
    response: {
      200: readGitActionReceiptResponseSchema,
    },
  },
  errors: [],
});

export const runGitActionEndpoint = defineEndpoint({
  method: 'POST',
  path: '/worktrees/:worktreeId/git/actions',
  schema: {
    params: worktreeParamsSchema,
    body: runGitActionRequestSchema,
    response: {
      200: runGitActionResponseSchema,
      202: runGitActionResponseSchema,
      409: runGitActionRejectedResponseSchema,
      503: runGitActionRejectedResponseSchema,
    },
  },
  errors: [],
});
