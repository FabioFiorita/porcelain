import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  editFileRequestSchema,
  editFileResponseSchema,
} from '@porcelain/contracts/files';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { EditFileUseCase } from '../../../use-cases/files/edit-file.ts';
import { EDIT_FILE_BODY_LIMIT } from '../../../config/request-limits.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function editFile(
  server: FastifyInstance,
  options: { useCase: Pick<EditFileUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/worktrees/:worktreeId/files',
    {
      schema: {
        params: worktreeParamsSchema,
        body: editFileRequestSchema,
        response: { ...errorResponses, 200: editFileResponseSchema },
      },
      bodyLimit: EDIT_FILE_BODY_LIMIT,
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, command: request.body },
        { signal: request.disconnected },
      ),
  );
}
