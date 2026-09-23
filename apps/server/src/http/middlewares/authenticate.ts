import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Application } from '../../application.ts';
import { UnauthorizedError } from '../errors/unauthorized-error.ts';
import { deviceCookie, setDeviceCookie } from './device-cookie.ts';

export type AuthenticateOptions = { application: Application };

function credentialOf(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  return deviceCookie(request);
}

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
    if (!request.ws) holdUntilRevoked(reply, application, device.deviceId);
    if (deviceCookie(request) === credential)
      setDeviceCookie(reply, credential, request.protocol === 'https');
  };
}

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
