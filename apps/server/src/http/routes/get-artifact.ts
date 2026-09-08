import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  artifactAddressSchema,
  artifactContentSchema,
} from '@porcelain/contracts/artifacts';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { toArtifactContent } from '../mappers/artifact-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function getArtifact(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/artifacts/:artifactId',
    {
      schema: {
        params: artifactAddressSchema,
        response: { ...errorResponses, 200: artifactContentSchema },
      },
    },
    async (request) =>
      toArtifactContent(
        await options.application.getArtifact(
          request.params.worktreeId,
          request.params.artifactId,
        ),
      ),
  );
}
