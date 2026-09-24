import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  issuePairingRequestSchema,
  issuePairingResponseSchema,
} from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { IssuePairingUseCase } from '../../../use-cases/access/issue-pairing.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function issuePairing(
  server: FastifyInstance,
  options: { useCase: Pick<IssuePairingUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/pairings',
    {
      schema: {
        body: issuePairingRequestSchema,
        response: { ...errorResponses, 200: issuePairingResponseSchema },
      },
    },
    (request) => options.useCase.execute(request.body, {}),
  );
}
