import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  apiErrorSchema,
  clearedBrowserSessionSchema,
} from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import { clearDeviceCookie } from '../middlewares/device-cookie.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';

export async function browserSessionRoutes(server: FastifyInstance) {
  server.addHook('onRequest', preventCaching);
  server.withTypeProvider<ZodTypeProvider>().delete(
    '/session',
    {
      schema: {
        response: { 403: apiErrorSchema, 204: clearedBrowserSessionSchema },
      },
    },
    async (request, reply) => {
      if (request.headers['x-porcelain-browser'] !== '1') {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Browser request header required',
        });
      }
      clearDeviceCookie(reply);
      return reply.code(204).send(undefined);
    },
  );
}
