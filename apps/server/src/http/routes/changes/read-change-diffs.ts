import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  readChangeDiffsRequestSchema,
  readChangeDiffsResponseSchema,
} from '@porcelain/contracts/changes';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ReadChangeDiffsUseCase } from '../../../use-cases/changes/read-change-diffs.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readChangeDiffs(
  server: FastifyInstance,
  options: { useCase: Pick<ReadChangeDiffsUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/worktrees/:worktreeId/changes/diffs',
    {
      schema: {
        params: worktreeParamsSchema,
        body: readChangeDiffsRequestSchema,
        response: { ...errorResponses, 200: readChangeDiffsResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
