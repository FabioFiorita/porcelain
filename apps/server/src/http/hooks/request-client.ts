import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IdentifyRequestClientUseCasePort } from '../../ports/identify-request-client-use-case-port.ts';
import { headerValue } from './header-value.ts';

const CONNECTING_ADDRESS_HEADER = 'cf-connecting-ip';
const FORWARDED_FOR_HEADER = 'x-forwarded-for';

export type RequestClientOptions = {
  access: { identifyRequestClient: IdentifyRequestClientUseCasePort };
};

export function identifyRequestClient(
  options: RequestClientOptions,
  strictTransport: { maxAgeSeconds: number },
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    request.client = await options.access.identifyRequestClient.execute(
      {
        host: request.headers.host,
        scheme: request.protocol,
        peerAddress: request.ip,
        localAddress: request.socket.localAddress,
        localPort: request.socket.localPort,
        connectingAddress: headerValue(
          request.headers[CONNECTING_ADDRESS_HEADER],
        ),
        forwardedFor: headerValue(request.headers[FORWARDED_FOR_HEADER]),
      },
      { signal: request.disconnected },
    );
    if (request.client.secure)
      reply.header(
        'Strict-Transport-Security',
        `max-age=${strictTransport.maxAgeSeconds}`,
      );
  };
}
