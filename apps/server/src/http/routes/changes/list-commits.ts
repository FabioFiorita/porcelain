import { listCommitsEndpoint } from '@porcelain/contracts/changes';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ListCommitsUseCase } from '../../../use-cases/changes/list-commits.ts';

export function listCommits(
  server: FastifyInstance,
  options: { useCase: Pick<ListCommitsUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: listCommitsEndpoint.method,
    url: listCommitsEndpoint.path,
    schema: listCommitsEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  });
}
