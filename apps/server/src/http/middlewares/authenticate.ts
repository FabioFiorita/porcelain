import type { FastifyReply, FastifyRequest } from 'fastify';
import { deviceCookie, setDeviceCookie } from './device-cookie.ts';

export type AuthenticateOptions = {
  application: {
    authenticateDevice(
      credential: string,
      address: string | null,
    ): { deviceId: string; idleMs: number } | null;
    holdForDevice(deviceId: string, connection: { close(): void }): () => void;
  };
};

function credentialOf(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  return deviceCookie(request);
}

export function authenticate(options: AuthenticateOptions) {
  const { application } = options;
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const credential = credentialOf(request);
    if (!credential) return rejectUnauthenticated(reply);
    const device = application.authenticateDevice(
      credential,
      request.ip ?? null,
    );
    if (!device) return rejectUnauthenticated(reply);
    request.principal = { kind: 'viewer', deviceId: device.deviceId };
    if (!request.ws) holdUntilRevoked(reply, application, device.deviceId);
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
  application: AuthenticateOptions['application'],
  deviceId: string,
) {
  const release = application.holdForDevice(deviceId, {
    close: () => reply.raw.destroy(),
  });
  reply.raw.on('close', release);
}
