import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { readHealthResponseSchema } from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { ReadHealthUseCase } from '../../../use-cases/access/read-health.ts';

export function readHealth(
  server: FastifyInstance,
  options: { useCase: Pick<ReadHealthUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/health',
    {
      schema: {
        response: { 200: readHealthResponseSchema },
      },
    },
    () => options.useCase.execute(),
  );
}
