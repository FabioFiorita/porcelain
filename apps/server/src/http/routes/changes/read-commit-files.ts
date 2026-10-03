import { readCommitFilesEndpoint } from '@porcelain/contracts/changes';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadCommitFilesUseCase } from '../../../use-cases/changes/read-commit-files.ts';

export function readCommitFiles(
  server: FastifyInstance,
  options: { useCase: Pick<ReadCommitFilesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readCommitFilesEndpoint.method,
    url: readCommitFilesEndpoint.path,
    schema: readCommitFilesEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  });
}
