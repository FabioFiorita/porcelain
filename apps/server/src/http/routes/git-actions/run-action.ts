import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  gitActionReceiptOrErrorSchema,
  gitActionReceiptSchema,
  gitActionScopeSchema,
  runGitActionRequestSchema,
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
          200: gitActionReceiptSchema,
          202: gitActionReceiptSchema,
          409: gitActionReceiptOrErrorSchema,
          503: gitActionReceiptOrErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const receipt = options.controller.execute(request.params, request.body);
      reply.code(gitActionReceiptStatus(receipt));
      return receipt;
    },
  );
}
