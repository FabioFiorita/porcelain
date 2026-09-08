import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  artifactAddressSchema,
  artifactContentSchema,
  artifactDeletionSchema,
  artifactListSchema,
  artifactMetadataSchema,
  artifactScopeSchema,
  uploadArtifactRequestSchema,
} from '@porcelain/contracts/artifacts';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { artifactLimits } from '../../models/artifact.ts';
import { InvalidArtifactError } from '../../use-cases/errors/invalid-artifact-error.ts';
import {
  toArtifactContent,
  toArtifactMetadata,
} from '../mappers/artifact-response.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export async function artifactRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options.token));
  server.addHook('onRequest', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
  });
  // Decode strictly before JSON parsing; the default parser would replace invalid UTF-8 bytes.
  server.removeContentTypeParser('application/json');
  server.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_request, body, done) => {
      try {
        done(
          null,
          JSON.parse(
            new TextDecoder('utf-8', { fatal: true }).decode(body as Buffer),
          ),
        );
      } catch {
        done(new InvalidArtifactError());
      }
    },
  );
  const routes = server.withTypeProvider<ZodTypeProvider>();
  const collection = '/worktrees/:worktreeId/artifacts';
  const item = `${collection}/:artifactId`;
  routes.post(
    collection,
    {
      // Worst-case JSON Unicode escaping plus bounded display-name/envelope overhead.
      bodyLimit: artifactLimits.contentBytes * 6 + 4096,
      schema: {
        params: artifactScopeSchema,
        body: uploadArtifactRequestSchema,
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
  routes.get(
    collection,
    {
      schema: {
        params: artifactScopeSchema,
        response: { ...errorResponses, 200: artifactListSchema },
      },
    },
    async (request) =>
      (await options.application.listArtifacts(request.params.worktreeId)).map(
        toArtifactMetadata,
      ),
  );
  routes.get(
    item,
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
  routes.delete(
    item,
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
