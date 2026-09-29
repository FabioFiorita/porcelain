import { httpErrors } from '@fastify/sensible';
import type { FastifyRequest } from 'fastify';
import type { CheckLocalRequestUseCasePort } from '../../ports/check-local-request-use-case-port.ts';

export type LocalDeviceOptions = {
  access: { checkLocalRequest: CheckLocalRequestUseCasePort };
};

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.join(', ') : value;
}

export function requireLocalDevice(options: LocalDeviceOptions) {
  return async (request: FastifyRequest) => {
    const verdict = await options.access.checkLocalRequest.execute(
      {
        host: request.headers.host,
        remoteAddress: request.socket.remoteAddress,
        localAddress: request.socket.localAddress,
        headers: Object.keys(request.headers),
        origin: request.headers.origin,
        referer: request.headers.referer,
        fetchSite: headerValue(request.headers['sec-fetch-site']),
      },
      { signal: request.disconnected },
    );
    if (verdict.kind !== 'local')
      throw httpErrors.forbidden(
        'Sharing is managed from a browser on the computer that runs Porcelain',
      );
  };
}
