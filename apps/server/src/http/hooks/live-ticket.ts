import { Effect } from 'effect';
import type { RedeemLiveTicketUseCasePort } from '../../ports/redeem-live-ticket-use-case-port.ts';
import { RequestContext } from '../request-context.ts';
import { RequestError } from '../../runtime/errors/request-error.ts';
import { authenticate, type AuthenticateOptions } from './authenticate.ts';

export type LiveTicketOptions = {
  access: { redeemLiveTicket: RedeemLiveTicketUseCasePort };
};
export function presentedTicket(
  context: RequestContext['Service'],
): string | undefined {
  const query = new URL(context.request.originalUrl, 'http://porcelain.invalid')
    .searchParams;
  const tickets = query.getAll('ticket');
  return tickets.length === 0
    ? undefined
    : tickets.length === 1
      ? tickets[0]
      : '';
}
export function authenticateLiveViewer(
  options: AuthenticateOptions & LiveTicketOptions,
  cookie: { cookieMaxAgeSeconds: number },
) {
  return Effect.gen(function* () {
    const context = yield* RequestContext;
    const ticket = presentedTicket(context);
    if (ticket === undefined) return yield* authenticate(options, cookie);
    const device = yield* options.access.redeemLiveTicket.execute({
      ticket,
      route: context.client.route,
    });
    if (!device)
      return yield* Effect.die(
        new RequestError({
          statusCode: 401,
          message: 'Authentication required',
        }),
      );
    context.principal = { kind: 'device', deviceId: device.deviceId };
  });
}
