import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { inventoryResponseSchema } from '@porcelain/contracts/inventory';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { toInventoryResponse } from '../mappers/inventory-response.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { clearBrowserSession } from '../middlewares/browser-session.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { errorResponses } from '../schemas/error-responses.ts';
export async function browserSessionRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.addHook('onRequest', preventCaching);
  server.withTypeProvider<ZodTypeProvider>().get(
    '/session',
    {
      onRequest: authenticate(options.token),
      schema: {
        response: { ...errorResponses, 200: inventoryResponseSchema },
      },
    },
    async () => {
      return toInventoryResponse(options.application.inventory());
    },
  );
  server.delete('/session', async (request, reply) => {
    if (request.headers['x-porcelain-browser'] !== '1') {
      return reply.code(403).send({
        code: 'UNAUTHORIZED',
        message: 'Browser request header required',
      });
    }
    clearBrowserSession(reply);
    return reply.code(204).send();
  });
}
