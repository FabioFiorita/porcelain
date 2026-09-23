import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  generateCommitDraftRequestSchema,
  generateCommitDraftResponseSchema,
  gitActionScopeSchema,
} from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { GenerateCommitDraftController } from '../../../controllers/generate-commit-draft-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function generateCommitDraft(
  server: FastifyInstance,
  options: { controller: Pick<GenerateCommitDraftController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/projects/:projectId/worktrees/:worktreeId/git/commit-draft',
    {
      schema: {
        params: gitActionScopeSchema,
        body: generateCommitDraftRequestSchema,
        response: { ...errorResponses, 200: generateCommitDraftResponseSchema },
      },
    },
    async (request, reply) => {
      const controller = new AbortController();
      const closed = () => {
        if (!reply.raw.writableFinished) controller.abort();
      };
      reply.raw.once('close', closed);
      try {
        return await options.controller.execute(
          request.params,
          request.body,
          controller.signal,
        );
      } finally {
        reply.raw.removeListener('close', closed);
      }
    },
  );
}
