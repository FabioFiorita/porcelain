import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { clearBrowserSessionResponseSchema } from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { ClearBrowserSessionUseCase } from '../../../use-cases/access/clear-browser-session.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function clearBrowserSession(
  server: FastifyInstance,
  options: { useCase: Pick<ClearBrowserSessionUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.delete(
    '/session',
    {
      schema: {
        response: { ...errorResponses, 204: clearBrowserSessionResponseSchema },
      },
    },
    async (request, reply) =>
      reply
        .code(204)
        .send(await options.useCase.execute({ signal: request.disconnected })),
  );
}
