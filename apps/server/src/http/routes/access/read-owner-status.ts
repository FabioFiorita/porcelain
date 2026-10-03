import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { readOwnerStatusResponseSchema } from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { ReadOwnerStatusUseCase } from '../../../use-cases/access/read-owner-status.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readOwnerStatus(
  server: FastifyInstance,
  options: { useCase: Pick<ReadOwnerStatusUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/status',
    {
      schema: {
        response: { ...errorResponses, 200: readOwnerStatusResponseSchema },
      },
    },
    () => options.useCase.execute({}),
  );
}
