import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { gitWorktreeParamsSchema } from '@porcelain/contracts/changes';
import {
  reviewedMarksResponseSchema,
  setReviewedRequestSchema,
} from '@porcelain/contracts/reviews';
import type { FastifyInstance } from 'fastify';
import type { SetReviewedFileController } from '../../../controllers/set-reviewed-file-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function setReviewedFile(
  server: FastifyInstance,
  options: { controller: Pick<SetReviewedFileController<unknown>, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.put(
    '/worktrees/:worktreeId/reviewed',
    {
      schema: {
        params: gitWorktreeParamsSchema,
        body: setReviewedRequestSchema,
        response: { ...errorResponses, 200: reviewedMarksResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
