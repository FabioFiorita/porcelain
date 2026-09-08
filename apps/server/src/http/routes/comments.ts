import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commentScopeSchema,
  commentThreadScopeSchema,
  commentThreadsSchema,
  createCommentThreadSchema,
  replyToCommentSchema,
  resolveCommentSchema,
} from '@porcelain/contracts/comments';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export async function commentRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options.token));
  const routes = server.withTypeProvider<ZodTypeProvider>();
  const response = { ...errorResponses, 200: commentThreadsSchema };
  routes.get(
    '/worktrees/:worktreeId/comments',
    { schema: { params: commentScopeSchema, response } },
    async (request) =>
      options.application.comments({ kind: 'list', ...request.params }),
  );
  routes.post(
    '/worktrees/:worktreeId/comments',
    {
      schema: {
        params: commentScopeSchema,
        body: createCommentThreadSchema,
        response,
      },
    },
    async (request) =>
      options.application.comments({
        kind: 'create',
        ...request.params,
        ...request.body,
      }),
  );
  routes.post(
    '/worktrees/:worktreeId/comments/:threadId/replies',
    {
      schema: {
        params: commentThreadScopeSchema,
        body: replyToCommentSchema,
        response,
      },
    },
    async (request) =>
      options.application.comments({
        kind: 'reply',
        ...request.params,
        ...request.body,
      }),
  );
  routes.put(
    '/worktrees/:worktreeId/comments/:threadId/resolution',
    {
      schema: {
        params: commentThreadScopeSchema,
        body: resolveCommentSchema,
        response,
      },
    },
    async (request) =>
      options.application.comments({
        kind: 'resolve',
        ...request.params,
        ...request.body,
      }),
  );
}
