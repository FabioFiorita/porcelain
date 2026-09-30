import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { issueLiveTicketResponseSchema } from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { IssueLiveTicketUseCase } from '../../../use-cases/access/issue-live-ticket.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function issueLiveTicket(
  server: FastifyInstance,
  options: { useCase: Pick<IssueLiveTicketUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/live/tickets',
    {
      schema: {
        response: { ...errorResponses, 200: issueLiveTicketResponseSchema },
      },
    },
    (request) =>
      options.useCase.execute(
        { viewer: request.caller, route: request.client.route },
        { signal: request.disconnected },
      ),
  );
}
