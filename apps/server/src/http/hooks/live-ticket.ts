import { httpErrors } from '@fastify/sensible';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { RedeemLiveTicketUseCasePort } from '../../ports/redeem-live-ticket-use-case-port.ts';
import { authenticate, type AuthenticateOptions } from './authenticate.ts';

const TICKET_PARAMETER = 'ticket';

export type LiveTicketOptions = {
  access: { redeemLiveTicket: RedeemLiveTicketUseCasePort };
};

export function presentedTicket(request: FastifyRequest): string | undefined {
  const query = request.query;
  if (typeof query !== 'object' || query === null) return undefined;
  if (!(TICKET_PARAMETER in query)) return undefined;
  const ticket: unknown = Reflect.get(query, TICKET_PARAMETER);
  return typeof ticket === 'string' ? ticket : '';
}

export function authenticateLiveViewer(
  options: AuthenticateOptions & LiveTicketOptions,
  cookie: { cookieMaxAgeSeconds: number },
) {
  const byCredential = authenticate(options, cookie);
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const ticket = presentedTicket(request);
    if (ticket === undefined) return byCredential(request, reply);
    const device = await options.access.redeemLiveTicket.execute(
      { ticket, route: request.client.route },
      { signal: request.disconnected },
    );
    if (!device) throw httpErrors.unauthorized('Authentication required');
    request.principal = { kind: 'device', deviceId: device.deviceId };
  };
}
