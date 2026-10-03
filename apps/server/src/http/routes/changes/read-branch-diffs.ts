import { readBranchDiffsEndpoint } from '@porcelain/contracts/changes';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadBranchDiffsUseCase } from '../../../use-cases/changes/read-branch-diffs.ts';

export function readBranchDiffs(
  server: FastifyInstance,
  options: { useCase: Pick<ReadBranchDiffsUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readBranchDiffsEndpoint.method,
    url: readBranchDiffsEndpoint.path,
    schema: readBranchDiffsEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  });
}
