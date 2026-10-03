import { readSessionEndpoint } from '@porcelain/contracts/access';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadSessionUseCase } from '../../../use-cases/access/read-session.ts';

export function readSession(
  server: FastifyInstance,
  options: { useCase: Pick<ReadSessionUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readSessionEndpoint.method,
    url: readSessionEndpoint.path,
    schema: readSessionEndpoint.schema,
    handler: (request) =>
      options.useCase.execute(
        { viewer: request.caller },
        { signal: request.disconnected },
      ),
  });
}
