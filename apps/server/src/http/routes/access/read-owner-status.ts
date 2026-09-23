import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { readOwnerStatusResponseSchema } from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { ReadOwnerStatusController } from '../../../controllers/read-owner-status-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readOwnerStatus(
  server: FastifyInstance,
  options: { controller: Pick<ReadOwnerStatusController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/status',
    {
      schema: {
        response: { ...errorResponses, 200: readOwnerStatusResponseSchema },
      },
    },
    () => options.controller.execute({}, {}),
  );
}
