import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { readServiceUpdateResponseSchema } from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { ReadServiceUpdateUseCase } from '../../../use-cases/access/read-service-update.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readServiceUpdate(
  server: FastifyInstance,
  options: { useCase: Pick<ReadServiceUpdateUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/service/update',
    {
      schema: {
        response: { ...errorResponses, 200: readServiceUpdateResponseSchema },
      },
    },
    (request) =>
      options.useCase.execute(
        { viewer: request.caller, local: request.local },
        { signal: request.disconnected },
      ),
  );
}
