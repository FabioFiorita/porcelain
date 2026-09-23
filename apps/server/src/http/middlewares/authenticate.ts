import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticateDeviceController } from '../../controllers/authenticate-device-controller.ts';
import { deviceCookie, setDeviceCookie } from './device-cookie.ts';

export type HeldConnection = { close(): void };

export type AuthenticateOptions = {
  authenticateDeviceController: Pick<AuthenticateDeviceController, 'execute'>;
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
    if (!credential) return rejectUnauthenticated(reply);
    const device = options.authenticateDeviceController.execute(
      { credential, address: request.ip },
      { signal: request.disconnected },
    );
    if (!device) return rejectUnauthenticated(reply);
    request.principal = { kind: 'viewer', deviceId: device.deviceId };
    if (!request.ws) holdUntilRevoked(reply, options.devices, device.deviceId);
    if (deviceCookie(request) === credential)
      setDeviceCookie(reply, credential, request.protocol === 'https');
  };
}

function rejectUnauthenticated(reply: FastifyReply) {
  return reply.code(401).header('WWW-Authenticate', 'Bearer').send({
    statusCode: 401,
    error: 'Unauthorized',
    message: 'Authentication required',
  });
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
