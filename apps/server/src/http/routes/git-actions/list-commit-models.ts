import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { listCommitModelsResponseSchema } from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { ListCommitModelsUseCase } from '../../../use-cases/git-actions/list-commit-models.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function listCommitModels(
  server: FastifyInstance,
  options: { useCase: Pick<ListCommitModelsUseCase, 'execute'> },
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
      options.useCase.execute({ signal: request.disconnected }),
  );
}
