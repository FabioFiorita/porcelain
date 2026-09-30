import type { FastifyCorsOptions } from '@fastify/cors';
import type { FastifyRequest } from 'fastify';
import { bearerCredential } from './authenticate.ts';

const PAIRING_PATH = '/api/pair';
const PAIRING_METHODS = new Set(['POST', 'OPTIONS']);

function pathOf(request: FastifyRequest): string {
  return request.url.split('?', 1)[0] ?? '';
}

function preflightForBearer(request: FastifyRequest): boolean {
  const requested = request.headers['access-control-request-headers'];
  return (
    typeof requested === 'string' &&
    requested
      .split(',')
      .some((header) => header.trim().toLowerCase() === 'authorization')
  );
}

function crossOriginClient(request: FastifyRequest): boolean {
  if (pathOf(request) === PAIRING_PATH && PAIRING_METHODS.has(request.method))
    return true;
  if (request.method === 'OPTIONS') return preflightForBearer(request);
  return bearerCredential(request) !== undefined;
}

export function crossOriginClients(options: { maxAgeSeconds: number }) {
  return (request: FastifyRequest): Promise<FastifyCorsOptions> =>
    Promise.resolve({
      origin: crossOriginClient(request) ? '*' : false,
      credentials: false,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['authorization', 'content-type'],
      maxAge: options.maxAgeSeconds,
    });
}
