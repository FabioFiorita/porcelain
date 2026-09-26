import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  revokeAccessRequestSchema,
  revokeAccessResponseSchema,
} from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { RevokeAccessUseCase } from '../../../use-cases/access/revoke-access.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function revokeAccess(
  server: FastifyInstance,
  options: { useCase: Pick<RevokeAccessUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/access/revoke',
    {
      schema: {
        body: revokeAccessRequestSchema,
        response: { ...errorResponses, 200: revokeAccessResponseSchema },
      },
    },
    (request) =>
      options.useCase.execute(request.body, {
        signal: request.disconnected,
      }),
  );
}
