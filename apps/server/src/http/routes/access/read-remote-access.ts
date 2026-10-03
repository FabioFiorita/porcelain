import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { readRemoteAccessResponseSchema } from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { ReadRemoteAccessUseCase } from '../../../use-cases/access/read-remote-access.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readRemoteAccess(
  server: FastifyInstance,
  options: { useCase: Pick<ReadRemoteAccessUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/remote-access',
    {
      schema: {
        response: { ...errorResponses, 200: readRemoteAccessResponseSchema },
      },
    },
    (request) => options.useCase.execute({ signal: request.disconnected }),
  );
}
