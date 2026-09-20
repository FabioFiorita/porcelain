import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { healthResponseSchema } from '@porcelain/contracts/health';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';

export async function healthRoute(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.withTypeProvider<ZodTypeProvider>().get(
    '/health',
    {
      schema: {
        response: { 200: healthResponseSchema },
      },
    },
    () => ({
      status: 'ok' as const,
      environmentId: options.application.inventory().environmentId,
    }),
  );
}
