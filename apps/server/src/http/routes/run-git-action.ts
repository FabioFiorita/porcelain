import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { apiErrorSchema } from '@porcelain/contracts/api-error';
import {
  gitActionReceiptSchema,
  gitActionScopeSchema,
  runGitActionRequestSchema,
} from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import {
  gitActionStatus,
  toGitActionReceipt,
} from '../mappers/git-action-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function runGitAction(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.withTypeProvider<ZodTypeProvider>().post(
    '/projects/:projectId/worktrees/:worktreeId/git/actions',
    {
      schema: {
        params: gitActionScopeSchema,
        body: runGitActionRequestSchema,
        response: {
          ...errorResponses,
          200: gitActionReceiptSchema,
          202: gitActionReceiptSchema,
          409: gitActionReceiptSchema.or(apiErrorSchema),
          503: gitActionReceiptSchema.or(apiErrorSchema),
        },
      },
    },
    (request, reply) => {
      const receipt = options.application.runGitAction(
        request.params,
        request.body,
      );
      reply.code(gitActionStatus(receipt));
      return toGitActionReceipt(receipt);
    },
  );
}
