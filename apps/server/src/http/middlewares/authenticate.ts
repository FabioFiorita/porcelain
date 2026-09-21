import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Application } from '../../application.ts';
import { UnauthorizedError } from '../errors/unauthorized-error.ts';
import { deviceCookie, setDeviceCookie } from './device-cookie.ts';

export type AuthenticateOptions = { application: Application };

function credentialOf(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  // A device credential is still a bearer credential for clients that have no
  // cookie jar; only the browser is cookie-only.
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  return deviceCookie(request);
}

/**
 * Resolve the caller to the device that paired, or refuse.
 *
 * There is no shared secret left: the only thing that authenticates here is a
 * credential a device redeemed for itself, which is why it always resolves to
 * that device and never to something the request names.
 */
export function authenticate(options: AuthenticateOptions) {
  const { application } = options;
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const credential = credentialOf(request);
    if (!credential) throw new UnauthorizedError();
    const device = application.authenticateDevice(
      credential,
      request.ip ?? null,
    );
    if (!device) throw new UnauthorizedError();
    request.principal = { kind: 'viewer', deviceId: device.deviceId };
    // An upgraded response is not the WebSocket lifetime. Its route registers
    // the socket itself; holding reply.raw here would race that graceful close
    // with a TCP destroy and turn revocation into an unexplained 1006.
    if (!request.ws) holdUntilRevoked(reply, application, device.deviceId);
    // Every cookie request renews the window, so a browser in constant use is
    // never logged out by age.
    if (deviceCookie(request) === credential)
      setDeviceCookie(reply, credential, request.protocol === 'https');
  };
}

/**
 * Revoking a device has to reach whatever it is holding open, not only its next
 * request. Destroying the socket also trips the disconnect signal installed at
 * the door, so queued work is abandoned too.
 */
function holdUntilRevoked(
  reply: FastifyReply,
  application: Application,
  deviceId: string,
) {
  const release = application.holdForDevice(deviceId, {
    close: () => reply.raw.destroy(),
  });
  reply.raw.on('close', release);
}
