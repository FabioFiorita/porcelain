import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  artifactAddressSchema,
  artifactDeletionSchema,
} from '@porcelain/contracts/artifacts';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function deleteArtifact(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.delete(
    '/worktrees/:worktreeId/artifacts/:artifactId',
    {
      schema: {
        params: artifactAddressSchema,
        response: { ...errorResponses, 200: artifactDeletionSchema },
      },
    },
    async (request) =>
      options.application.deleteArtifact(
        request.params.worktreeId,
        request.params.artifactId,
      ),
  );
}
