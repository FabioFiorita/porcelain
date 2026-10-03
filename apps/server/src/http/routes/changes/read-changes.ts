import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { readChangesResponseSchema } from '@porcelain/contracts/changes';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ReadChangesUseCase } from '../../../use-cases/changes/read-changes.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readChanges(
  server: FastifyInstance,
  options: { useCase: Pick<ReadChangesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/changes',
    {
      schema: {
        params: worktreeParamsSchema,
        response: { ...errorResponses, 200: readChangesResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
