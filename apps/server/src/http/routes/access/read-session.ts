import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { readSessionResponseSchema } from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { ReadSessionUseCase } from '../../../use-cases/access/read-session.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readSession(
  server: FastifyInstance,
  options: { useCase: Pick<ReadSessionUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/session',
    {
      schema: {
        response: { ...errorResponses, 200: readSessionResponseSchema },
      },
    },
    (request) =>
      options.useCase.execute(
        { viewer: request.caller },
        { signal: request.disconnected },
      ),
  );
}
