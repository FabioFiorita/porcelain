import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  worktreeParamsSchema,
  worktreePathsSchema,
} from '@porcelain/contracts/files';
import type { FastifyInstance } from 'fastify';
import type { ListWorktreePathsController } from '../../../controllers/list-worktree-paths-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function listWorktreePaths(
  server: FastifyInstance,
  options: { controller: Pick<ListWorktreePathsController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/paths',
    {
      schema: {
        params: worktreeParamsSchema,
        response: { ...errorResponses, 200: worktreePathsSchema },
      },
    },
    async (request) =>
      options.controller.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
