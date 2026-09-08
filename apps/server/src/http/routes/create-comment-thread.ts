import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commentScopeSchema,
  commentThreadsSchema,
  createCommentThreadSchema,
} from '@porcelain/contracts/comments';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function createCommentThread(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/worktrees/:worktreeId/comments',
    {
      schema: {
        tags: ['Comments'],
        summary: 'Start a discussion on a file or code range',
        params: commentScopeSchema,
        body: createCommentThreadSchema.meta({
          examples: [
            {
              anchor: { kind: 'file', filePath: 'README.md' },
              body: 'What motivated this change?',
            },
          ],
        }),
        response: { ...errorResponses, 200: commentThreadsSchema },
      },
    },
    async (request) =>
      options.application.comments({
        kind: 'create',
        ...request.params,
        ...request.body,
      }),
  );
}
