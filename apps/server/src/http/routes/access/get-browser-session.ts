import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import type { FastifyInstance } from 'fastify';
import type { ReadInventoryUseCase } from '../../../use-cases/projects/read-inventory.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function getBrowserSession(
  server: FastifyInstance,
  options: { useCase: Pick<ReadInventoryUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/session',
    {
      schema: {
        response: { ...errorResponses, 200: readInventoryResponseSchema },
      },
    },
    (request) => options.useCase.execute({ signal: request.disconnected }),
  );
}
