import { generateCommitDraftEndpoint } from '@porcelain/contracts/git-actions';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { GenerateCommitDraftUseCase } from '../../../use-cases/git-actions/generate-commit-draft.ts';

export function generateCommitDraft(
  server: FastifyInstance,
  options: { useCase: Pick<GenerateCommitDraftUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: generateCommitDraftEndpoint.method,
    url: generateCommitDraftEndpoint.path,
    schema: generateCommitDraftEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  });
}
