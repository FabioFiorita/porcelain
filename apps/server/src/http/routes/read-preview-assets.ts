import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  previewAssetsRequestSchema,
  previewAssetsResponseSchema,
  worktreeParamsSchema,
} from '@porcelain/contracts/files';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function readPreviewAssets(
  server: FastifyInstance,
  options: { application: Application },
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
    async (request) => ({
      assets: await options.application.previewAssets(
        request.params.worktreeId,
        request.body.document,
        request.body.paths,
        request.disconnected,
      ),
    }),
  );
}
