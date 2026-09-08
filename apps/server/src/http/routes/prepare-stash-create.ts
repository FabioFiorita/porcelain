import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  gitActionPreparationSchema,
  gitActionScopeSchema,
  stashCreatePreparationRequestSchema,
} from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { toGitActionPreparation } from '../mappers/git-action-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function prepareStashCreate(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.withTypeProvider<ZodTypeProvider>().post(
    '/projects/:projectId/worktrees/:worktreeId/git/stash/create/prepare',
    {
      schema: {
        tags: ['Git actions'],
        summary: 'Prepare stash creation',
        params: gitActionScopeSchema,
        body: stashCreatePreparationRequestSchema.meta({
          examples: [{ message: 'Review later', includeUntracked: true }],
        }),
        response: { ...errorResponses, 200: gitActionPreparationSchema },
      },
    },
    async (request) =>
      toGitActionPreparation(
        await options.application.prepareStashCreate(
          request.params,
          request.body,
        ),
      ),
  );
}
