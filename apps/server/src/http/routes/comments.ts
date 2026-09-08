import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { createCommentThread } from './create-comment-thread.ts';
import { listCommentThreads } from './list-comment-threads.ts';
import { replyToComment } from './reply-to-comment.ts';
import { resolveCommentThread } from './resolve-comment-thread.ts';

export async function commentRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options.token));
  listCommentThreads(server, options);
  createCommentThread(server, options);
  replyToComment(server, options);
  resolveCommentThread(server, options);
}
