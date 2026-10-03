import { readCommitDiffsEndpoint } from '@porcelain/contracts/changes';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadCommitDiffsUseCase } from '../../../use-cases/changes/read-commit-diffs.ts';

export function readCommitDiffs(
  server: FastifyInstance,
  options: { useCase: Pick<ReadCommitDiffsUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readCommitDiffsEndpoint.method,
    url: readCommitDiffsEndpoint.path,
    schema: readCommitDiffsEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  });
}
