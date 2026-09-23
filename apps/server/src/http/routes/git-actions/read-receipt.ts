import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  readGitActionReceiptParamsSchema,
  readGitActionReceiptResponseSchema,
} from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { ReadGitActionReceiptController } from '../../../controllers/read-git-action-receipt-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readReceipt(
  server: FastifyInstance,
  options: { controller: Pick<ReadGitActionReceiptController, 'execute'> },
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
    async (request) => options.controller.execute(request.params.requestId),
  );
}
