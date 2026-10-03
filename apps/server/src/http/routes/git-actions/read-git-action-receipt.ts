import { readGitActionReceiptEndpoint } from '@porcelain/contracts/git-actions';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadGitActionReceiptUseCase } from '../../../use-cases/git-actions/read-git-action-receipt.ts';

export function readGitActionReceipt(
  server: FastifyInstance,
  options: { useCase: Pick<ReadGitActionReceiptUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readGitActionReceiptEndpoint.method,
    url: readGitActionReceiptEndpoint.path,
    schema: readGitActionReceiptEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  });
}
