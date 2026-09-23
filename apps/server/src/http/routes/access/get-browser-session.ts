import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import type { FastifyInstance } from 'fastify';
import type { ReadInventoryController } from '../../../controllers/read-inventory-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function getBrowserSession(
  server: FastifyInstance,
  options: { controller: Pick<ReadInventoryController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/session',
    {
      schema: {
        response: { ...errorResponses, 200: readInventoryResponseSchema },
      },
    },
    (request) =>
      options.controller.execute({}, { signal: request.disconnected }),
  );
}
