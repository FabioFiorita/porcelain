import { httpErrors } from '@fastify/sensible';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { clearBrowserSessionResponseSchema } from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import { clearDeviceCookie } from '../hooks/device-cookie.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function clearBrowserSession(server: FastifyInstance) {
  server.withTypeProvider<ZodTypeProvider>().delete(
    '/session',
    {
      schema: {
        response: { ...errorResponses, 204: clearBrowserSessionResponseSchema },
      },
    },
    async (request, reply) => {
      if (request.headers['x-porcelain-browser'] !== '1')
        throw httpErrors.forbidden('Browser request header required');
      clearDeviceCookie(reply);
      return reply.code(204).send(undefined);
    },
  );
}
