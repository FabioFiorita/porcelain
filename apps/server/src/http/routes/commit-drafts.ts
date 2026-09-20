import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commitDraftRequestSchema,
  commitDraftResponseSchema,
  commitModelsSchema,
} from '@porcelain/contracts/commit-draft';
import { gitActionScopeSchema } from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { errorResponses } from '../schemas/error-responses.ts';
export async function commitDraftRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.addHook('onRequest', authenticate(options.token));
  server.addHook('onSend', preventCaching);
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/git/commit-models',
    { schema: { response: { ...errorResponses, 200: commitModelsSchema } } },
    async (request) => options.application.commitModels(request.disconnected),
  );
  api.post(
    '/projects/:projectId/worktrees/:worktreeId/git/commit-draft',
    {
      schema: {
        params: gitActionScopeSchema,
        body: commitDraftRequestSchema,
        response: { ...errorResponses, 200: commitDraftResponseSchema },
      },
    },
    async (request, reply) => {
      const controller = new AbortController();
      const closed = () => {
        if (!reply.raw.writableFinished) controller.abort();
      };
      reply.raw.once('close', closed);
      try {
        return await options.application.draftCommits(
          request.params,
          request.body,
          controller.signal,
        );
      } finally {
        reply.raw.removeListener('close', closed);
      }
    },
  );
}
