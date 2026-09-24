import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  generateCommitDraftRequestSchema,
  generateCommitDraftResponseSchema,
  gitActionScopeSchema,
} from '@porcelain/contracts/git-actions';
import type { FastifyInstance } from 'fastify';
import type { GenerateCommitDraftUseCase } from '../../../use-cases/git-actions/generate-commit-draft.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function generateCommitDraft(
  server: FastifyInstance,
  options: { useCase: Pick<GenerateCommitDraftUseCase, 'execute'> },
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
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
