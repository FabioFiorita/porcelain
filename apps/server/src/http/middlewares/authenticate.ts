import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Application } from '../../application.ts';
import type { AuthenticatedPrincipal } from '../../models/principal.ts';
import { UnauthorizedError } from '../errors/unauthorized-error.ts';
import {
  browserSessionValid,
  deviceCookie,
  setBrowserSession,
  setDeviceCookie,
} from './browser-session.ts';

const viewer: AuthenticatedPrincipal = { kind: 'viewer', deviceId: null };

export type AuthenticateOptions = {
  token: string;
  application: Application;
  /** What the legacy shared token grants at this door. Devices never use it. */
  grant?: AuthenticatedPrincipal;
};

function credentialOf(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  return deviceCookie(request);
}

/**
 * Check the caller's credential and record who they are.  The grant is the
 * door's, not the caller's: nothing a request carries can name a principal.
 *
 * The two credentials are deliberately independent. A device credential always
 * resolves to its own device and never to `grant`, because the MCP door passes
 * `{ kind: 'agent' }` — routing devices through the same result would let a
 * stolen browser credential replayed at `/api/mcp` be attributed and authorized
 * as an agent. Only the local socket door establishes `agent`.
 */
export function authenticate(options: AuthenticateOptions) {
  const { token, application, grant = viewer } = options;
  const expected = Buffer.from(`Bearer ${token}`);
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const credential = credentialOf(request);
    if (credential) {
      const device = application.authenticateDevice(
        credential,
        request.ip ?? null,
      );
      if (device) {
        request.principal = { kind: 'viewer', deviceId: device.deviceId };
        holdUntilRevoked(reply, application, device.deviceId);
        // Every cookie request renews the window. Refreshing only after an idle
        // gap looks cheaper but is wrong: a browser used every hour never
        // reaches the gap, so its original cookie would still expire on day 90 —
        // the constant-use logout the decision rules out. The cost is one
        // header on responses to a cookie-authenticated request.
        if (deviceCookie(request) === credential)
          setDeviceCookie(reply, credential, request.protocol === 'https');
        return;
      }
    }

    if (!request.headers.authorization && browserSessionValid(request, token)) {
      request.principal = grant;
      return;
    }
    const received = Buffer.from(request.headers.authorization ?? '');
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      throw new UnauthorizedError();
    }
    request.principal = grant;
    const path = request.url.split('?', 1)[0];
    if (
      request.method === 'GET' &&
      path === '/api/inventory' &&
      request.headers['x-porcelain-browser'] === '1'
    ) {
      setBrowserSession(reply, token, request.protocol === 'https');
    }
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
