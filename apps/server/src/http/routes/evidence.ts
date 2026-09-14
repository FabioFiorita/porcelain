import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { evidenceResponseSchema } from '@porcelain/contracts/evidence';
import { gitWorktreeParamsSchema } from '@porcelain/contracts/git-status';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { toEvidenceResponse } from '../mappers/evidence-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function evidenceRoute(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/evidence',
    {
      schema: {
        params: gitWorktreeParamsSchema,
        response: { ...errorResponses, 200: evidenceResponseSchema },
      },
    },
    async (request) =>
      toEvidenceResponse(
        await options.application.reviewEvidence(request.params.worktreeId),
      ),
  );
}
