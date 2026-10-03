import { editCommentMessageEndpoint } from '@porcelain/contracts/reviews';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { EditCommentMessageUseCase } from '../../../use-cases/reviews/edit-comment-message.ts';

export function editCommentMessage(
  server: FastifyInstance,
  options: { useCase: Pick<EditCommentMessageUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: editCommentMessageEndpoint.method,
    url: editCommentMessageEndpoint.path,
    schema: editCommentMessageEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body, writer: request.caller },
        { signal: request.disconnected },
      ),
  });
}
