import { readBranchChangesEndpoint } from '@porcelain/contracts/changes';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadBranchChangesUseCase } from '../../../use-cases/changes/read-branch-changes.ts';

export function readBranchChanges(
  server: FastifyInstance,
  options: { useCase: Pick<ReadBranchChangesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readBranchChangesEndpoint.method,
    url: readBranchChangesEndpoint.path,
    schema: readBranchChangesEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  });
}
