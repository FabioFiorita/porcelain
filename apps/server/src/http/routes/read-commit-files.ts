import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commitDiffsRequestSchema,
  commitDiffsResponseSchema,
  commitFilesParamsSchema,
  commitFilesQuerySchema,
  commitFilesResponseSchema,
} from '@porcelain/contracts/commit-changes';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import {
  toCommitDiffsResponse,
  toCommitFilesResponse,
} from '../mappers/history-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function readCommitFiles(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/commits/:oid/files',
    {
      schema: {
        params: commitFilesParamsSchema,
        querystring: commitFilesQuerySchema,
        response: { ...errorResponses, 200: commitFilesResponseSchema },
      },
    },
    async (request) =>
      toCommitFilesResponse(
        await options.application.commitFiles(
          request.params.worktreeId,
          {
            oid: request.params.oid,
            ...(request.query.parent !== undefined
              ? { parent: request.query.parent }
              : {}),
          },
          request.disconnected,
        ),
      ),
  );
  api.post(
    '/worktrees/:worktreeId/commits/:oid/diffs',
    {
      schema: {
        params: commitFilesParamsSchema,
        body: commitDiffsRequestSchema,
        response: { ...errorResponses, 200: commitDiffsResponseSchema },
      },
    },
    async (request) =>
      toCommitDiffsResponse(
        request.params.oid,
        request.body.paths,
        await options.application.commitDiffs(
          request.params.worktreeId,
          {
            oid: request.params.oid,
            ...(request.body.parent !== undefined
              ? { parent: request.body.parent }
              : {}),
            paths: request.body.paths.flat(),
          },
          request.disconnected,
        ),
      ),
  );
}
