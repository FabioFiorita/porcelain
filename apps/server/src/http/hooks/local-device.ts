import { Effect } from 'effect';
import { RequestContext } from '../request-context.ts';
import { RequestError } from '../../runtime/errors/request-error.ts';
import type { CheckLocalRequestUseCasePort } from '../../ports/check-local-request-use-case-port.ts';
import { headerValue } from './header-value.ts';

export type LocalDeviceOptions = {
  access: { checkLocalRequest: CheckLocalRequestUseCasePort };
};

function askedFromThisComputer(options: LocalDeviceOptions) {
  return Effect.gen(function* () {
    const context = yield* RequestContext;
    const verdict = yield* options.access.checkLocalRequest.execute({
      host: context.request.headers.host,
      route: context.client.route,
      remoteAddress: context.incoming.socket.remoteAddress,
      localAddress: context.incoming.socket.localAddress,
      headers: Object.keys(context.request.headers),
      origin: context.request.headers.origin,
      referer: context.request.headers.referer,
      fetchSite: headerValue(context.request.headers['sec-fetch-site']),
    });
    return verdict.kind === 'local';
  });
}

export function requireLocalDevice(options: LocalDeviceOptions) {
  return Effect.gen(function* () {
    if (!(yield* askedFromThisComputer(options)))
      return yield* Effect.die(
        new RequestError({
          statusCode: 403,
          message:
            'Sharing is managed from a browser on the computer that runs Porcelain',
        }),
      );
  });
}

export function recognizeLocalRequest(options: LocalDeviceOptions) {
  return Effect.gen(function* () {
    const context = yield* RequestContext;
    context.local = yield* askedFromThisComputer(options);
  });
}
