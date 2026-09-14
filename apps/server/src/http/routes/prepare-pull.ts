import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  fetchPreparationRequestSchema,
  gitActionPreparationSchema,
  gitActionScopeSchema,
} from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { toGitActionPreparation } from '../mappers/git-action-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function preparePull(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.withTypeProvider<ZodTypeProvider>().post(
    '/projects/:projectId/worktrees/:worktreeId/git/pull/prepare',
    {
      schema: {
        params: gitActionScopeSchema,
        body: fetchPreparationRequestSchema,
        response: { ...errorResponses, 200: gitActionPreparationSchema },
      },
    },
    async (request) =>
      toGitActionPreparation(
        await options.application.preparePull(request.params, request.body),
      ),
  );
}
