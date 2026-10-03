import { issueLiveTicketEndpoint } from '@porcelain/contracts/access';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { IssueLiveTicketUseCase } from '../../../use-cases/access/issue-live-ticket.ts';

export function issueLiveTicket(
  server: FastifyInstance,
  options: { useCase: Pick<IssueLiveTicketUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: issueLiveTicketEndpoint.method,
    url: issueLiveTicketEndpoint.path,
    schema: issueLiveTicketEndpoint.schema,
    handler: (request) =>
      options.useCase.execute(
        { viewer: request.caller, route: request.client.route },
        { signal: request.disconnected },
      ),
  });
}
