import { clearBrowserSessionEndpoint } from '@porcelain/contracts/access';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ClearBrowserSessionUseCase } from '../../../use-cases/access/clear-browser-session.ts';

export function clearBrowserSession(
  server: FastifyInstance,
  options: { useCase: Pick<ClearBrowserSessionUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: clearBrowserSessionEndpoint.method,
    url: clearBrowserSessionEndpoint.path,
    schema: clearBrowserSessionEndpoint.schema,
    handler: async (request, reply) =>
      reply
        .code(204)
        .send(await options.useCase.execute({ signal: request.disconnected })),
  });
}
