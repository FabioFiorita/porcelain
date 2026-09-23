import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  revokeAccessRequestSchema,
  revokeAccessResponseSchema,
} from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { RevokeAccessController } from '../../../controllers/revoke-access-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function revokeAccess(
  server: FastifyInstance,
  options: { controller: Pick<RevokeAccessController, 'execute'> },
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
    (request) => options.controller.execute(request.body, {}),
  );
}
