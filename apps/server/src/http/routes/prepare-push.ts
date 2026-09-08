import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  gitActionPreparationSchema,
  gitActionScopeSchema,
  pushPreparationRequestSchema,
} from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { toGitActionPreparation } from '../mappers/git-action-response.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function preparePush(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.withTypeProvider<ZodTypeProvider>().post(
    '/projects/:projectId/worktrees/:worktreeId/git/push/prepare',
    {
      schema: {
        tags: ['Git actions'],
        summary: 'Prepare push',
        params: gitActionScopeSchema,
        body: pushPreparationRequestSchema.meta({
          examples: [
            {
              remoteName: 'origin',
              destinationRef: 'refs/heads/review',
              allowCreate: false,
            },
          ],
        }),
        response: { ...errorResponses, 200: gitActionPreparationSchema },
      },
    },
    async (request) =>
      toGitActionPreparation(
        await options.application.preparePush(request.params, request.body),
      ),
  );
}
