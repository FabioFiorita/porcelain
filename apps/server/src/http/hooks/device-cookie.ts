import type { FastifyReply, FastifyRequest } from 'fastify';
import { LIMITS } from '../../config/limits.ts';

const COOKIE_NAME = 'porcelain_device';

export function deviceCookie(request: FastifyRequest): string | null {
  const cookies = (request.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${COOKIE_NAME}=`));
  return cookies.length === 1
    ? (cookies[0]?.slice(COOKIE_NAME.length + 1) ?? null)
    : null;
}

export function setDeviceCookie(
  reply: FastifyReply,
  credential: string,
  secure: boolean,
) {
  reply.header(
    'Set-Cookie',
    `${COOKIE_NAME}=${credential}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${LIMITS.access.device.cookieMaxAgeSeconds}${secure ? '; Secure' : ''}`,
  );
}

export function clearDeviceCookie(reply: FastifyReply) {
  reply.header(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0`,
  );
}
