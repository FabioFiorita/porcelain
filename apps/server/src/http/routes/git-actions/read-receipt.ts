import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  readGitActionReceiptParamsSchema,
  readGitActionReceiptResponseSchema,
} from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { ReadGitActionReceiptUseCase } from '../../../use-cases/git-actions/read-git-action-receipt.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readReceipt(
  server: FastifyInstance,
  options: { useCase: Pick<ReadGitActionReceiptUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/git-action-requests/:requestId',
    {
      schema: {
        params: readGitActionReceiptParamsSchema,
        response: {
          ...errorResponses,
          200: readGitActionReceiptResponseSchema,
        },
      },
    },
    async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
