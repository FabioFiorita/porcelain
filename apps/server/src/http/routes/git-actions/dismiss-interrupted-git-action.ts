import { dismissInterruptedGitActionEndpoint } from '@porcelain/contracts/git-actions';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { DismissInterruptedGitActionUseCase } from '../../../use-cases/git-actions/dismiss-interrupted-git-action.ts';

export function dismissInterruptedGitAction(
  server: FastifyInstance,
  options: {
    useCase: Pick<DismissInterruptedGitActionUseCase, 'execute'>;
  },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: dismissInterruptedGitActionEndpoint.method,
    url: dismissInterruptedGitActionEndpoint.path,
    schema: dismissInterruptedGitActionEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  });
}
