import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commitChangesParamsSchema,
  commitChangesQuerySchema,
  commitChangesResponseSchema,
} from '@porcelain/contracts/commit-changes';
import {
  commitPageQuerySchema,
  commitPageResponseSchema,
  historyParamsSchema,
} from '@porcelain/contracts/commit-history';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export async function commitHistoryRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options.token));
  server.withTypeProvider<ZodTypeProvider>().get(
    '/worktrees/:worktreeId/commits',
    {
      schema: {
        params: historyParamsSchema,
        querystring: commitPageQuerySchema,
        response: { ...errorResponses, 200: commitPageResponseSchema },
      },
    },
    async (request) =>
      options.application.listCommits(request.params.worktreeId, {
        ...(request.query.limit !== undefined
          ? { limit: request.query.limit }
          : {}),
        ...(request.query.cursor !== undefined
          ? { cursor: request.query.cursor }
          : {}),
      }),
  );
  server.withTypeProvider<ZodTypeProvider>().get(
    '/worktrees/:worktreeId/commits/:oid/changes',
    {
      schema: {
        params: commitChangesParamsSchema,
        querystring: commitChangesQuerySchema,
        response: { ...errorResponses, 200: commitChangesResponseSchema },
      },
    },
    async (request) =>
      options.application.inspectCommitChanges(request.params.worktreeId, {
        oid: request.params.oid,
        ...(request.query.parent !== undefined
          ? { parent: request.query.parent }
          : {}),
      }),
  );
}
