import { listBranchBasesEndpoint } from '@porcelain/contracts/changes';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ListBranchBasesUseCase } from '../../../use-cases/changes/list-branch-bases.ts';

export function listBranchBases(
  server: FastifyInstance,
  options: { useCase: Pick<ListBranchBasesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: listBranchBasesEndpoint.method,
    url: listBranchBasesEndpoint.path,
    schema: listBranchBasesEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  });
}
