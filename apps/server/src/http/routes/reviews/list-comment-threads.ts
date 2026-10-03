import { listCommentThreadsEndpoint } from '@porcelain/contracts/reviews';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ListCommentThreadsUseCase } from '../../../use-cases/reviews/list-comment-threads.ts';

export function listCommentThreads(
  server: FastifyInstance,
  options: { useCase: Pick<ListCommentThreadsUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: listCommentThreadsEndpoint.method,
    url: listCommentThreadsEndpoint.path,
    schema: listCommentThreadsEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  });
}
