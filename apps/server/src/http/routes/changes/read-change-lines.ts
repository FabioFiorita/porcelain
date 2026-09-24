import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  readChangeLinesQuerySchema,
  readChangeLinesResponseSchema,
} from '@porcelain/contracts/changes';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ReadChangeLinesUseCase } from '../../../use-cases/changes/read-change-lines.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readChangeLines(
  server: FastifyInstance,
  options: { useCase: Pick<ReadChangeLinesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/changes/lines',
    {
      schema: {
        params: worktreeParamsSchema,
        querystring: readChangeLinesQuerySchema,
        response: { ...errorResponses, 200: readChangeLinesResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
