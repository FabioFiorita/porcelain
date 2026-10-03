import { deleteCommentMessageEndpoint } from '@porcelain/contracts/reviews';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { DeleteCommentMessageUseCase } from '../../../use-cases/reviews/delete-comment-message.ts';

export function deleteCommentMessage(
  server: FastifyInstance,
  options: { useCase: Pick<DeleteCommentMessageUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: deleteCommentMessageEndpoint.method,
    url: deleteCommentMessageEndpoint.path,
    schema: deleteCommentMessageEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query, writer: request.caller },
        { signal: request.disconnected },
      ),
  });
}
