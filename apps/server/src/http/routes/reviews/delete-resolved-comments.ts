import { deleteResolvedCommentsEndpoint } from '@porcelain/contracts/reviews';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { DeleteResolvedCommentsUseCase } from '../../../use-cases/reviews/delete-resolved-comments.ts';

export function deleteResolvedComments(
  server: FastifyInstance,
  options: { useCase: Pick<DeleteResolvedCommentsUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: deleteResolvedCommentsEndpoint.method,
    url: deleteResolvedCommentsEndpoint.path,
    schema: deleteResolvedCommentsEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body, writer: request.caller },
        { signal: request.disconnected },
      ),
  });
}
