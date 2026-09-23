import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  issuePairingRequestSchema,
  issuePairingResponseSchema,
} from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { IssuePairingController } from '../../../controllers/issue-pairing-controller.ts';
import { preventCaching } from '../../middlewares/prevent-caching.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export async function issuePairing(
  server: FastifyInstance,
  options: { controller: Pick<IssuePairingController, 'execute'> },
) {
  server.addHook('onRequest', preventCaching);
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/pairings',
    {
      schema: {
        body: issuePairingRequestSchema,
        response: { ...errorResponses, 200: issuePairingResponseSchema },
      },
    },
    (request) => options.controller.execute(request.body, {}),
  );
}
