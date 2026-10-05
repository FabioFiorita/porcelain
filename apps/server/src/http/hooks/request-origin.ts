import { Effect } from 'effect';
import { withSignal } from '@porcelain/effects';
import { httpErrors } from '@fastify/sensible';
import type { FastifyRequest } from 'fastify';
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
  request: FastifyRequest,
  policy: OriginPolicy,
): PresentedCredential {
  if (policy.crossOrigin === 'ticket' && presentedTicket(request) !== undefined)
    return 'ticket';
  return bearerCredential(request) === undefined ? 'none' : 'bearer';
}

export function checkRequestOrigin(
  options: RequestOriginOptions,
  policy: OriginPolicy,
) {
  return async (request: FastifyRequest) => {
    const result = await Effect.runPromise(
      withSignal(
        options.access.checkRequestOrigin.execute({
          host: request.headers.host,
          origin: request.headers.origin,
          method: request.method,
          scheme: request.protocol,
          localAddress: request.socket.localAddress,
          localPort: request.socket.localPort,
          allowedHosts: options.allowedHosts,
          requireSameOrigin: policy.requireSameOrigin ?? false,
          crossOrigin: policy.crossOrigin,
          credential: presentedCredential(request, policy),
        }),
        request.disconnected,
      ),
    );
    if (!result.allowed)
      throw httpErrors.forbidden(refusalMessage(result.refusal));
    request.crossOrigin = result.crossOrigin;
  };
}
