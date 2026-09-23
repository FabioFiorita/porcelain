import type { FastifyReply, FastifyRequest } from 'fastify';
import { setDeviceCookie } from './device-cookie.ts';

function withoutCredential(payload: unknown) {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('credential' in payload) ||
    typeof payload.credential !== 'string'
  )
    return undefined;
  const { credential, ...rest } = payload;
  return { credential, rest };
}

export async function deliverBrowserCredential(
  request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
) {
  const split = withoutCredential(payload);
  if (!split || request.headers['x-porcelain-browser'] !== '1') return payload;
  setDeviceCookie(reply, split.credential, request.protocol === 'https');
  return split.rest;
}
