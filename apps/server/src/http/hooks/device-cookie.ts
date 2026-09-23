import type { FastifyReply, FastifyRequest } from 'fastify';

const name = 'porcelain_device';
const duration = 90 * 24 * 60 * 60;

export function deviceCookie(request: FastifyRequest): string | null {
  const cookies = (request.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  return cookies.length === 1
    ? (cookies[0]?.slice(name.length + 1) ?? null)
    : null;
}

export function setDeviceCookie(
  reply: FastifyReply,
  credential: string,
  secure: boolean,
) {
  reply.header(
    'Set-Cookie',
    `${name}=${credential}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${duration}${secure ? '; Secure' : ''}`,
  );
}

export function clearDeviceCookie(reply: FastifyReply) {
  reply.header(
    'Set-Cookie',
    `${name}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0`,
  );
}
