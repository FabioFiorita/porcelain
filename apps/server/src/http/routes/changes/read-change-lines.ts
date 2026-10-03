import { readChangeLinesEndpoint } from '@porcelain/contracts/changes';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadChangeLinesUseCase } from '../../../use-cases/changes/read-change-lines.ts';

export function readChangeLines(
  server: FastifyInstance,
  options: { useCase: Pick<ReadChangeLinesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readChangeLinesEndpoint.method,
    url: readChangeLinesEndpoint.path,
    schema: readChangeLinesEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  });
}
