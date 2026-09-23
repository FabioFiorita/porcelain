import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { inventoryResponseSchema } from '@porcelain/contracts/projects';
import type { FastifyInstance } from 'fastify';
import type { ReadInventoryController } from '../../../controllers/read-inventory-controller.ts';
import {
  authenticate,
  type AuthenticateOptions,
} from '../../middlewares/authenticate.ts';
import { preventCaching } from '../../middlewares/prevent-caching.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function getBrowserSession(
  server: FastifyInstance,
  options: AuthenticateOptions & {
    controller: Pick<ReadInventoryController, 'execute'>;
  },
) {
  server.addHook('onRequest', preventCaching);
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/session',
    {
      onRequest: authenticate(options),
      schema: {
        response: { ...errorResponses, 200: inventoryResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute({ signal: request.disconnected }),
  );
}
