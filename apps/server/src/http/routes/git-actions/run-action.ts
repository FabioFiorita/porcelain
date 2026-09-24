import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  gitActionScopeSchema,
  runGitActionRejectedResponseSchema,
  runGitActionRequestSchema,
  runGitActionResponseSchema,
} from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { RunGitActionUseCase } from '../../../use-cases/git-actions/run-git-action.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function runAction(
  server: FastifyInstance,
  options: { useCase: Pick<RunGitActionUseCase, 'execute'> },
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
    },
    (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
