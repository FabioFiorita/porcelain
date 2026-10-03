import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  readProofFileQuerySchema,
  readProofFileResponseSchema,
} from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ReadProofFileUseCase } from '../../../use-cases/reviews/read-proof-file.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readProofFile(
  server: FastifyInstance,
  options: { useCase: Pick<ReadProofFileUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/review/proof',
    {
      schema: {
        params: worktreeParamsSchema,
        querystring: readProofFileQuerySchema,
        response: { ...errorResponses, 200: readProofFileResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
