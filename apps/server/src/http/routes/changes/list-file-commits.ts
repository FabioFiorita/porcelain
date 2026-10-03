import { listFileCommitsEndpoint } from '@porcelain/contracts/changes';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ListFileCommitsUseCase } from '../../../use-cases/changes/list-file-commits.ts';

export function listFileCommits(
  server: FastifyInstance,
  options: { useCase: Pick<ListFileCommitsUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: listFileCommitsEndpoint.method,
    url: listFileCommitsEndpoint.path,
    schema: listFileCommitsEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  });
}
