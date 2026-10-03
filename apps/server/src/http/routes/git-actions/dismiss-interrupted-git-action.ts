import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  dismissInterruptedGitActionParamsSchema,
  dismissInterruptedGitActionResponseSchema,
} from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { DismissInterruptedGitActionUseCase } from '../../../use-cases/git-actions/dismiss-interrupted-git-action.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function dismissInterruptedGitAction(
  server: FastifyInstance,
  options: {
    useCase: Pick<DismissInterruptedGitActionUseCase, 'execute'>;
  },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.delete(
    '/worktrees/:worktreeId/git/interrupted/:requestId',
    {
      schema: {
        params: dismissInterruptedGitActionParamsSchema,
        response: {
          ...errorResponses,
          200: dismissInterruptedGitActionResponseSchema,
        },
      },
    },
    async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
