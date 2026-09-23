import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  changeDiffsRequestSchema,
  changeDiffsResponseSchema,
  changeLinesQuerySchema,
  changeLinesResponseSchema,
  changesResponseSchema,
} from '@porcelain/contracts/changes';
import { gitWorktreeParamsSchema } from '@porcelain/contracts/git-status';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export async function changeRoutes(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options));
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/changes',
    {
      schema: {
        params: gitWorktreeParamsSchema,
        response: { ...errorResponses, 200: changesResponseSchema },
      },
    },
    async (request) =>
      options.application.changes(
        request.params.worktreeId,
        request.disconnected,
      ),
  );
  api.post(
    '/worktrees/:worktreeId/changes/diffs',
    {
      schema: {
        params: gitWorktreeParamsSchema,
        body: changeDiffsRequestSchema,
        response: { ...errorResponses, 200: changeDiffsResponseSchema },
      },
    },
    async (request) =>
      options.application.changeDiffs(
        request.params.worktreeId,
        request.body.expectedStatusToken,
        request.body.expectedFiles,
        request.body.selections,
        request.disconnected,
      ),
  );
  api.get(
    '/worktrees/:worktreeId/changes/lines',
    {
      schema: {
        params: gitWorktreeParamsSchema,
        querystring: changeLinesQuerySchema,
        response: { ...errorResponses, 200: changeLinesResponseSchema },
      },
    },
    async (request) =>
      options.application.changeLines(
        request.params.worktreeId,
        request.query,
        request.disconnected,
      ),
  );
}
