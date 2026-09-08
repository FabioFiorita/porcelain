import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { apiErrorSchema } from '@porcelain/contracts/api-error';
import {
  gitActionExecutionRequestSchema,
  gitActionReceiptSchema,
  gitActionScopeSchema,
} from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { gitActionStatus } from '../mappers/git-action-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function executeStashApply(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.withTypeProvider<ZodTypeProvider>().post(
    '/projects/:projectId/worktrees/:worktreeId/git/stash/apply',
    {
      schema: {
        params: gitActionScopeSchema,
        body: gitActionExecutionRequestSchema,
        response: {
          ...errorResponses,
          200: gitActionReceiptSchema,
          202: gitActionReceiptSchema,
          409: gitActionReceiptSchema.or(apiErrorSchema),
          503: gitActionReceiptSchema.or(apiErrorSchema),
        },
      },
    },
    async (request, reply) => {
      const receipt = options.application.executeStashApply(
        request.params,
        request.body,
      );
      return reply.code(gitActionStatus(receipt)).send(receipt);
    },
  );
}
