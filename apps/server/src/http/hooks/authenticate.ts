import { httpErrors } from '@fastify/sensible';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { DeviceConnectionStore } from '../../ports/device-connection-store.ts';
import type { AuthenticateDeviceUseCase } from '../../use-cases/access/authenticate-device.ts';
import { deviceCookie, setDeviceCookie } from './device-cookie.ts';

const AUTHENTICATION_REQUIRED = 'Authentication required';

export type AuthenticateOptions = {
  access: { authenticateDevice: Pick<AuthenticateDeviceUseCase, 'execute'> };
  deviceConnections: Pick<DeviceConnectionStore, 'insert'>;
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
    const device = await options.access.authenticateDevice.execute(
      { credential, address: request.ip },
      { signal: request.disconnected },
    );
    if (!device) throw httpErrors.unauthorized(AUTHENTICATION_REQUIRED);
    request.principal = { kind: 'device', deviceId: device.deviceId };
    if (!request.ws)
      holdUntilRevoked(reply, options.deviceConnections, device.deviceId);
    if (deviceCookie(request) === credential)
      setDeviceCookie(reply, credential, request.protocol === 'https');
  };
}

function holdUntilRevoked(
  reply: FastifyReply,
  deviceConnections: AuthenticateOptions['deviceConnections'],
  deviceId: string,
) {
  const release = deviceConnections.insert({
    deviceId,
    connection: { close: () => reply.raw.destroy() },
  });
  reply.raw.on('close', release);
}
