import { Effect } from 'effect';
import { withSignal } from '@porcelain/effects';
import { httpErrors } from '@fastify/sensible';
import type { FastifyRequest } from 'fastify';
import type { CheckLocalRequestUseCasePort } from '../../ports/check-local-request-use-case-port.ts';
import { headerValue } from './header-value.ts';

export type LocalDeviceOptions = {
  access: { checkLocalRequest: CheckLocalRequestUseCasePort };
};

async function askedFromThisComputer(
  options: LocalDeviceOptions,
  request: FastifyRequest,
): Promise<boolean> {
  const verdict = await Effect.runPromise(
    withSignal(
      options.access.checkLocalRequest.execute({
        host: request.headers.host,
        route: request.client.route,
        remoteAddress: request.socket.remoteAddress,
        localAddress: request.socket.localAddress,
        headers: Object.keys(request.headers),
        origin: request.headers.origin,
        referer: request.headers.referer,
        fetchSite: headerValue(request.headers['sec-fetch-site']),
      }),
      request.disconnected,
    ),
  );
  return verdict.kind === 'local';
}

export function requireLocalDevice(options: LocalDeviceOptions) {
  return async (request: FastifyRequest) => {
    if (!(await askedFromThisComputer(options, request)))
      throw httpErrors.forbidden(
        'Sharing is managed from a browser on the computer that runs Porcelain',
      );
  };
}

export function recognizeLocalRequest(options: LocalDeviceOptions) {
  return async (request: FastifyRequest) => {
    request.local = await askedFromThisComputer(options, request);
  };
}
