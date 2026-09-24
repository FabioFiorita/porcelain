import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { listWorktreePathsResponseSchema } from '@porcelain/contracts/files';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ListWorktreePathsUseCase } from '../../../use-cases/files/list-worktree-paths.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function listWorktreePaths(
  server: FastifyInstance,
  options: { useCase: Pick<ListWorktreePathsUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/paths',
    {
      schema: {
        params: worktreeParamsSchema,
        response: { ...errorResponses, 200: listWorktreePathsResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
