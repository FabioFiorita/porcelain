import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  artifactMetadataSchema,
  artifactScopeSchema,
  uploadArtifactRequestSchema,
} from '@porcelain/contracts/artifacts';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { artifactLimits } from '../../models/artifact.ts';
import { toArtifactMetadata } from '../mappers/artifact-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function uploadArtifact(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/worktrees/:worktreeId/artifacts',
    {
      // Worst-case JSON Unicode escaping plus bounded display-name/envelope overhead.
      bodyLimit: artifactLimits.contentBytes * 6 + 4096,
      schema: {
        tags: ['Artifacts'],
        summary: 'Store an HTML artifact outside Git',
        params: artifactScopeSchema,
        body: uploadArtifactRequestSchema.meta({
          examples: [
            {
              name: 'Review notes',
              content: '<h1>Review</h1><p>Explain the change here.</p>',
            },
          ],
        }),
        response: { ...errorResponses, 201: artifactMetadataSchema },
      },
    },
    async (request, reply) =>
      reply
        .code(201)
        .send(
          toArtifactMetadata(
            await options.application.uploadArtifact(
              request.params.worktreeId,
              request.body,
            ),
          ),
        ),
  );
}
