import type { FastifyReply, FastifyRequest } from 'fastify';

const name = 'porcelain_device';
/** Matches the device credential's own 90-day unused lifetime. */
const duration = 90 * 24 * 60 * 60;

/** The device credential as the browser holds it: HttpOnly, so no script reads it. */
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

/**
 * Disconnect takes the browser's credential away. The old token-derived
 * `porcelain_session` cookie is not read anywhere any more, so nothing here
 * looks for it; a browser still holding one simply keeps an inert value until
 * it expires on its own.
 */
export function clearDeviceCookie(reply: FastifyReply) {
  reply.header(
    'Set-Cookie',
    `${name}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0`,
  );
}
