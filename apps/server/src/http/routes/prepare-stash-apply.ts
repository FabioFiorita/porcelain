import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  gitActionPreparationSchema,
  gitActionScopeSchema,
  stashApplyPreparationRequestSchema,
} from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { toGitActionPreparation } from '../mappers/git-action-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function prepareStashApply(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.withTypeProvider<ZodTypeProvider>().post(
    '/projects/:projectId/worktrees/:worktreeId/git/stash/apply/prepare',
    {
      schema: {
        tags: ['Git actions'],
        summary: 'Prepare stash application',
        params: gitActionScopeSchema,
        body: stashApplyPreparationRequestSchema,
        response: { ...errorResponses, 200: gitActionPreparationSchema },
      },
    },
    async (request) =>
      toGitActionPreparation(
        await options.application.prepareStashApply(
          request.params,
          request.body,
        ),
      ),
  );
}
