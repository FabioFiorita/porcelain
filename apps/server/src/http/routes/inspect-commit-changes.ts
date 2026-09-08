import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commitChangesParamsSchema,
  commitChangesQuerySchema,
  commitChangesResponseSchema,
} from '@porcelain/contracts/commit-changes';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { toCommitChangesResponse } from '../mappers/history-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function inspectCommitChanges(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/commits/:oid/changes',
    {
      schema: {
        tags: ['History'],
        summary: 'Inspect changes in a commit',
        params: commitChangesParamsSchema,
        querystring: commitChangesQuerySchema,
        response: { ...errorResponses, 200: commitChangesResponseSchema },
      },
    },
    async (request) =>
      toCommitChangesResponse(
        await options.application.inspectCommitChanges(
          request.params.worktreeId,
          {
            oid: request.params.oid,
            ...(request.query.parent !== undefined
              ? { parent: request.query.parent }
              : {}),
          },
        ),
      ),
  );
}
