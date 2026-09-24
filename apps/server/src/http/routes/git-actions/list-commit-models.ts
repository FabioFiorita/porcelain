import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { listCommitModelsResponseSchema } from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { ListCommitModelsController } from '../../../controllers/list-commit-models-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function listCommitModels(
  server: FastifyInstance,
  options: { controller: Pick<ListCommitModelsController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/git/commit-models',
    {
      schema: {
        response: { ...errorResponses, 200: listCommitModelsResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute({ signal: request.disconnected }),
  );
}
