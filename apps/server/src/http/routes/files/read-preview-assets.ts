import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  readPreviewAssetsRequestSchema,
  readPreviewAssetsResponseSchema,
} from '@porcelain/contracts/files';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ReadPreviewAssetsUseCase } from '../../../use-cases/files/read-preview-assets.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readPreviewAssets(
  server: FastifyInstance,
  options: { useCase: Pick<ReadPreviewAssetsUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/worktrees/:worktreeId/preview-assets',
    {
      schema: {
        params: worktreeParamsSchema,
        body: readPreviewAssetsRequestSchema,
        response: { ...errorResponses, 200: readPreviewAssetsResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
