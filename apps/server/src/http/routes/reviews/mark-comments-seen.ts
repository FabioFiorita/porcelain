import { markCommentsSeenEndpoint } from '@porcelain/contracts/reviews';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { MarkCommentsSeenUseCase } from '../../../use-cases/reviews/mark-comments-seen.ts';

export function markCommentsSeen(
  server: FastifyInstance,
  options: { useCase: Pick<MarkCommentsSeenUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: markCommentsSeenEndpoint.method,
    url: markCommentsSeenEndpoint.path,
    schema: markCommentsSeenEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  });
}
