import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  artifactListSchema,
  artifactScopeSchema,
} from '@porcelain/contracts/artifacts';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { toArtifactMetadata } from '../mappers/artifact-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function listArtifacts(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/artifacts',
    {
      schema: {
        tags: ['Artifacts'],
        summary: 'List stored HTML artifacts',
        params: artifactScopeSchema,
        response: { ...errorResponses, 200: artifactListSchema },
      },
    },
    async (request) =>
      (await options.application.listArtifacts(request.params.worktreeId)).map(
        toArtifactMetadata,
      ),
  );
}
