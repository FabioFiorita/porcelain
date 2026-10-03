import { readChangeDiffsEndpoint } from '@porcelain/contracts/changes';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadChangeDiffsUseCase } from '../../../use-cases/changes/read-change-diffs.ts';

export function readChangeDiffs(
  server: FastifyInstance,
  options: { useCase: Pick<ReadChangeDiffsUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readChangeDiffsEndpoint.method,
    url: readChangeDiffsEndpoint.path,
    schema: readChangeDiffsEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  });
}
