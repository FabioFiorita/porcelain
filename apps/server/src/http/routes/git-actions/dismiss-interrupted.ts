import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  dismissInterruptedResponseSchema,
  gitActionDismissParamsSchema,
} from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { DismissInterruptedGitActionController } from '../../../controllers/dismiss-interrupted-git-action-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function dismissInterrupted(
  server: FastifyInstance,
  options: {
    controller: Pick<DismissInterruptedGitActionController, 'execute'>;
  },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.delete(
    '/projects/:projectId/worktrees/:worktreeId/git/interrupted/:requestId',
    {
      schema: {
        params: gitActionDismissParamsSchema,
        response: { ...errorResponses, 200: dismissInterruptedResponseSchema },
      },
    },
    async (request) => options.controller.execute(request.params),
  );
}
