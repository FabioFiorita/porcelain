import { listWorktreePathsEndpoint } from '@porcelain/contracts/files';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ListWorktreePathsUseCase } from '../../../use-cases/files/list-worktree-paths.ts';

export function listWorktreePaths(
  server: FastifyInstance,
  options: { useCase: Pick<ListWorktreePathsUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: listWorktreePathsEndpoint.method,
    url: listWorktreePathsEndpoint.path,
    schema: listWorktreePathsEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  });
}
