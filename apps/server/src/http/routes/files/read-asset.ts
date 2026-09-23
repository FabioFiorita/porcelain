import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  assetResponseSchema,
  fileQuerySchema,
  worktreeParamsSchema,
} from '@porcelain/contracts/files';
import type { FastifyInstance } from 'fastify';
import type { ReadFileAssetController } from '../../../controllers/read-file-asset-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readAsset(
  server: FastifyInstance,
  options: { controller: Pick<ReadFileAssetController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/asset',
    {
      schema: {
        params: worktreeParamsSchema,
        querystring: fileQuerySchema,
        response: { ...errorResponses, 200: assetResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
