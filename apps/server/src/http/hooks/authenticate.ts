import { httpErrors } from '@fastify/sensible';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticateDeviceUseCase } from '../../use-cases/access/authenticate-device.ts';
import { deviceCookie, setDeviceCookie } from './device-cookie.ts';

const AUTHENTICATION_REQUIRED = 'Authentication required';

export type HeldConnection = { close(): void };

export type AuthenticateOptions = {
  access: { authenticateDevice: Pick<AuthenticateDeviceUseCase, 'execute'> };
  devices: { hold(deviceId: string, connection: HeldConnection): () => void };
};

function credentialOf(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  return deviceCookie(request) ?? undefined;
}

export function authenticate(options: AuthenticateOptions) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const credential = credentialOf(request);
    if (!credential) throw httpErrors.unauthorized(AUTHENTICATION_REQUIRED);
    const device = options.access.authenticateDevice.execute({
      credential,
      address: request.ip,
    });
    if (!device) throw httpErrors.unauthorized(AUTHENTICATION_REQUIRED);
    request.principal = { kind: 'device', deviceId: device.deviceId };
    if (!request.ws) holdUntilRevoked(reply, options.devices, device.deviceId);
    if (deviceCookie(request) === credential)
      setDeviceCookie(reply, credential, request.protocol === 'https');
  };
}

function holdUntilRevoked(
  reply: FastifyReply,
  devices: AuthenticateOptions['devices'],
  deviceId: string,
) {
  const release = devices.hold(deviceId, {
    close: () => reply.raw.destroy(),
  });
  reply.raw.on('close', release);
}
