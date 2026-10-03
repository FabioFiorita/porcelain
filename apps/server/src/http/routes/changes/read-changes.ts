import { readChangesEndpoint } from '@porcelain/contracts/changes';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadChangesUseCase } from '../../../use-cases/changes/read-changes.ts';

export function readChanges(
  server: FastifyInstance,
  options: { useCase: Pick<ReadChangesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readChangesEndpoint.method,
    url: readChangesEndpoint.path,
    schema: readChangesEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  });
}
