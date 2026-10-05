import { Effect } from 'effect';
import { RequestContext } from '../request-context.ts';
import { RequestError } from '../../runtime/errors/request-error.ts';
import type {
  CheckRequestOriginUseCasePort,
  CrossOriginPolicy,
  PresentedCredential,
  RequestOriginVerdict,
} from '../../ports/check-request-origin-use-case-port.ts';
import { bearerCredential } from './authenticate.ts';
import { presentedTicket } from './live-ticket.ts';

type Refusal = Extract<RequestOriginVerdict, { allowed: false }>['refusal'];

export type RequestOriginOptions = {
  access: { checkRequestOrigin: CheckRequestOriginUseCasePort };
  allowedHosts: readonly string[];
};

type OriginPolicy = {
  crossOrigin: CrossOriginPolicy;
  requireSameOrigin?: boolean;
};

function refusalMessage(refusal: Refusal): string {
  switch (refusal.kind) {
    case 'host-malformed':
      return 'The Host header is missing or malformed';
    case 'host-not-allowed':
      return `This server does not answer to the host ${refusal.hostname}`;
    case 'origin-required':
      return 'The Origin header is required';
    case 'origin-opaque':
      return 'An opaque origin cannot write';
    case 'origin-malformed':
      return 'The Origin header is malformed';
    case 'cross-origin':
      return `The origin ${refusal.origin} cannot write here`;
  }
}

function presentedCredential(
  context: RequestContext['Service'],
  policy: OriginPolicy,
): PresentedCredential {
  if (policy.crossOrigin === 'ticket' && presentedTicket(context) !== undefined)
    return 'ticket';
  return bearerCredential(context) === undefined ? 'none' : 'bearer';
}

export function checkRequestOrigin(
  options: RequestOriginOptions,
  policy: OriginPolicy,
) {
  return Effect.gen(function* () {
    const context = yield* RequestContext;
    const result = yield* options.access.checkRequestOrigin.execute({
      host: context.request.headers.host,
      origin: context.request.headers.origin,
      method: context.request.method,
      scheme: context.client.secure ? 'https' : 'http',
      localAddress: context.incoming.socket.localAddress,
      localPort: context.incoming.socket.localPort,
      allowedHosts: options.allowedHosts,
      requireSameOrigin: policy.requireSameOrigin ?? false,
      crossOrigin: policy.crossOrigin,
      credential: presentedCredential(context, policy),
    });
    if (!result.allowed)
      return yield* Effect.die(
        new RequestError({
          statusCode: 403,
          message: refusalMessage(result.refusal),
        }),
      );
    context.crossOrigin = result.crossOrigin;
  });
}
