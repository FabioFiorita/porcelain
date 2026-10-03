import { startServiceUpdateEndpoint } from '@porcelain/contracts/access';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { StartServiceUpdateUseCase } from '../../../use-cases/access/start-service-update.ts';

export function startServiceUpdate(
  server: FastifyInstance,
  options: { useCase: Pick<StartServiceUpdateUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: startServiceUpdateEndpoint.method,
    url: startServiceUpdateEndpoint.path,
    schema: startServiceUpdateEndpoint.schema,
    handler: async (request, reply) => {
      const state = await options.useCase.execute(
        {
          version: request.body.version,
          viewer: request.caller,
          local: request.local,
        },
        { signal: request.disconnected },
      );
      return reply.code(202).send(state);
    },
  });
}
