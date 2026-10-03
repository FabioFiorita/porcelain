import { createCommentThreadEndpoint } from '@porcelain/contracts/reviews';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { CreateCommentThreadUseCase } from '../../../use-cases/reviews/create-comment-thread.ts';

export function createCommentThread(
  server: FastifyInstance,
  options: { useCase: Pick<CreateCommentThreadUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: createCommentThreadEndpoint.method,
    url: createCommentThreadEndpoint.path,
    schema: createCommentThreadEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body, writer: request.caller },
        { signal: request.disconnected },
      ),
  });
}
