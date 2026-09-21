import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  gitActionReceiptSchema,
  gitActionRequestParamsSchema,
} from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { toGitActionReceipt } from '../mappers/git-action-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function getGitActionReceipt(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.withTypeProvider<ZodTypeProvider>().get(
    '/git-action-requests/:requestId',
    {
      schema: {
        params: gitActionRequestParamsSchema,
        response: { ...errorResponses, 200: gitActionReceiptSchema },
      },
    },
    async (request) =>
      toGitActionReceipt(
        options.application.gitActionReceipt(request.params.requestId),
      ),
  );
}
