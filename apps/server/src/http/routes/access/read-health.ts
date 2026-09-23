import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { readHealthResponseSchema } from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { ReadHealthController } from '../../../controllers/read-health-controller.ts';

export function readHealth(
  server: FastifyInstance,
  options: { controller: Pick<ReadHealthController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/health',
    {
      schema: {
        response: { 200: readHealthResponseSchema },
      },
    },
    (request) =>
      options.controller.execute({}, { signal: request.disconnected }),
  );
}
