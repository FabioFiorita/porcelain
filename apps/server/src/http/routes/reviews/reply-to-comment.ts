import { replyToCommentEndpoint } from '@porcelain/contracts/reviews';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReplyToCommentUseCase } from '../../../use-cases/reviews/reply-to-comment.ts';

export function replyToComment(
  server: FastifyInstance,
  options: { useCase: Pick<ReplyToCommentUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: replyToCommentEndpoint.method,
    url: replyToCommentEndpoint.path,
    schema: replyToCommentEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body, writer: request.caller },
        { signal: request.disconnected },
      ),
  });
}
