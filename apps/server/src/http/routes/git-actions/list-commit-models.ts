import { listCommitModelsEndpoint } from '@porcelain/contracts/git-actions';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ListCommitModelsUseCase } from '../../../use-cases/git-actions/list-commit-models.ts';

export function listCommitModels(
  server: FastifyInstance,
  options: { useCase: Pick<ListCommitModelsUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: listCommitModelsEndpoint.method,
    url: listCommitModelsEndpoint.path,
    schema: listCommitModelsEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute({ signal: request.disconnected }),
  });
}
