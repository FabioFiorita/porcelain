import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  previewAssetsRequestSchema,
  previewAssetsResponseSchema,
  worktreeParamsSchema,
} from '@porcelain/contracts/files';
import type { FastifyInstance } from 'fastify';
import type { ReadPreviewAssetsController } from '../../../controllers/read-preview-assets-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readPreviewAssets(
  server: FastifyInstance,
  options: { controller: Pick<ReadPreviewAssetsController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/worktrees/:worktreeId/preview-assets',
    {
      schema: {
        params: worktreeParamsSchema,
        body: previewAssetsRequestSchema,
        response: { ...errorResponses, 200: previewAssetsResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
