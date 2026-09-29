import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  setRemoteAccessRequestSchema,
  setRemoteAccessResponseSchema,
} from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { SetRemoteAccessUseCase } from '../../../use-cases/access/set-remote-access.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function setRemoteAccess(
  server: FastifyInstance,
  options: { useCase: Pick<SetRemoteAccessUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.patch(
    '/remote-access',
    {
      schema: {
        body: setRemoteAccessRequestSchema,
        response: { ...errorResponses, 200: setRemoteAccessResponseSchema },
      },
    },
    (request) =>
      options.useCase.execute(request.body, {
        signal: request.disconnected,
      }),
  );
}
