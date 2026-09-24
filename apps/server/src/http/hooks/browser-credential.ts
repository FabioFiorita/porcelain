import { httpErrors } from '@fastify/sensible';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { clearDeviceCookie, setDeviceCookie } from './device-cookie.ts';

const BROWSER_HEADER = 'x-porcelain-browser';

function fromBrowser(request: FastifyRequest): boolean {
  return request.headers[BROWSER_HEADER] === '1';
}

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
  if (!split || !fromBrowser(request)) return payload;
  setDeviceCookie(reply, split.credential, request.protocol === 'https');
  return split.rest;
}

export async function requireBrowserRequest(request: FastifyRequest) {
  if (!fromBrowser(request))
    throw httpErrors.forbidden('Browser request header required');
}

export async function endBrowserSession(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  clearDeviceCookie(reply);
  reply.code(204);
}
