import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { readGitStatusResponseSchema } from '@porcelain/contracts/changes';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ReadGitStatusUseCase } from '../../../use-cases/changes/read-git-status.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readGitStatus(
  server: FastifyInstance,
  options: { useCase: Pick<ReadGitStatusUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/git/status',
    {
      schema: {
        params: worktreeParamsSchema,
        response: { ...errorResponses, 200: readGitStatusResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
