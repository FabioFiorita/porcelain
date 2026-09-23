import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  gitActionScopeSchema,
  runGitActionRejectedResponseSchema,
  runGitActionRequestSchema,
  runGitActionResponseSchema,
} from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { RunGitActionController } from '../../../controllers/run-git-action-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';
import { gitActionReceiptStatus } from '../../status-policy.ts';

export function runAction(
  server: FastifyInstance,
  options: { controller: Pick<RunGitActionController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/projects/:projectId/worktrees/:worktreeId/git/actions',
    {
      schema: {
        params: gitActionScopeSchema,
        body: runGitActionRequestSchema,
        response: {
          ...errorResponses,
          200: runGitActionResponseSchema,
          202: runGitActionResponseSchema,
          409: runGitActionRejectedResponseSchema,
          503: runGitActionRejectedResponseSchema,
        },
      },
      preSerialization: async (_request, reply, payload: unknown) => {
        if (isReceipt(payload)) reply.code(gitActionReceiptStatus(payload));
        return payload;
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}

function isReceipt(payload: unknown): payload is { state: string } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'state' in payload &&
    typeof payload.state === 'string'
  );
}
