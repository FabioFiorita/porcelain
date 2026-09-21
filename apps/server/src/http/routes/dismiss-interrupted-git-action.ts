import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  dismissInterruptedResponseSchema,
  gitActionDismissParamsSchema,
} from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function dismissInterruptedGitAction(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.withTypeProvider<ZodTypeProvider>().delete(
    '/projects/:projectId/worktrees/:worktreeId/git/interrupted/:requestId',
    {
      schema: {
        params: gitActionDismissParamsSchema,
        response: { ...errorResponses, 200: dismissInterruptedResponseSchema },
      },
    },
    (request) => {
      const { requestId, ...scope } = request.params;
      options.application.dismissInterrupted(scope, requestId);
      return { dismissed: true as const };
    },
  );
}
