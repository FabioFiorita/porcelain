import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { readEnvironmentResponseSchema } from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { ReadEnvironmentUseCase } from '../../../use-cases/access/read-environment.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readEnvironment(
  server: FastifyInstance,
  options: { useCase: Pick<ReadEnvironmentUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/environment',
    {
      schema: {
        response: { ...errorResponses, 200: readEnvironmentResponseSchema },
      },
    },
    (request) => options.useCase.execute({ signal: request.disconnected }),
  );
}
