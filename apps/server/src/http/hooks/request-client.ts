import { Effect } from 'effect';
import { RequestContext } from '../request-context.ts';
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
  return Effect.gen(function* () {
    const context = yield* RequestContext;
    context.client = yield* options.access.identifyRequestClient.execute({
      host: context.request.headers.host,
      scheme: context.client.secure ? 'https' : 'http',
      peerAddress: context.incoming.socket.remoteAddress ?? '',
      localAddress: context.incoming.socket.localAddress,
      localPort: context.incoming.socket.localPort,
      connectingAddress: headerValue(
        context.request.headers[CONNECTING_ADDRESS_HEADER],
      ),
      forwardedFor: headerValue(context.request.headers[FORWARDED_FOR_HEADER]),
    });
    if (context.client.secure)
      context.response.setHeader(
        'Strict-Transport-Security',
        `max-age=${strictTransport.maxAgeSeconds}`,
      );
  });
}
