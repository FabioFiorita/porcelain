import { updateCommentThreadEndpoint } from '@porcelain/contracts/reviews';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { UpdateCommentThreadUseCase } from '../../../use-cases/reviews/update-comment-thread.ts';

export function updateCommentThread(
  server: FastifyInstance,
  options: { useCase: Pick<UpdateCommentThreadUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: updateCommentThreadEndpoint.method,
    url: updateCommentThreadEndpoint.path,
    schema: updateCommentThreadEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  });
}
