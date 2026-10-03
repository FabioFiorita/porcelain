import { runGitActionEndpoint } from '@porcelain/contracts/git-actions';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { RunGitActionUseCase } from '../../../use-cases/git-actions/run-git-action.ts';
import { gitActionReceiptStatus } from '../../status-policy.ts';

export function runGitAction(
  server: FastifyInstance,
  options: { useCase: Pick<RunGitActionUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: runGitActionEndpoint.method,
    url: runGitActionEndpoint.path,
    schema: runGitActionEndpoint.schema,
    handler: async (request, reply) => {
      const receipt = await options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      );
      return reply.code(gitActionReceiptStatus(receipt)).send(receipt);
    },
  });
}
