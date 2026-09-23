import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  fileEditResultSchema,
  fileEditSchema,
  worktreeParamsSchema,
} from '@porcelain/contracts/files';
import type { FastifyInstance } from 'fastify';
import type { EditFileController } from '../../../controllers/edit-file-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function editFile(
  server: FastifyInstance,
  options: { controller: Pick<EditFileController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/worktrees/:worktreeId/files',
    {
      schema: {
        params: worktreeParamsSchema,
        body: fileEditSchema,
        response: { ...errorResponses, 200: fileEditResultSchema },
      },
      bodyLimit: 8 * 1024 * 1024,
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, command: request.body },
        { signal: request.disconnected },
      ),
  );
}
