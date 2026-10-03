import { readGitStatusEndpoint } from '@porcelain/contracts/changes';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadGitStatusUseCase } from '../../../use-cases/changes/read-git-status.ts';

export function readGitStatus(
  server: FastifyInstance,
  options: { useCase: Pick<ReadGitStatusUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readGitStatusEndpoint.method,
    url: readGitStatusEndpoint.path,
    schema: readGitStatusEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  });
}
