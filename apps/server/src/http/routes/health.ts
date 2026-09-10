import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { healthResponseSchema } from '@porcelain/contracts/health';
import type { FastifyInstance } from 'fastify';

export async function healthRoute(server: FastifyInstance) {
  server.withTypeProvider<ZodTypeProvider>().get(
    '/health',
    {
      schema: {
        response: { 200: healthResponseSchema },
      },
    },
    () => ({ status: 'ok' as const }),
  );
}
