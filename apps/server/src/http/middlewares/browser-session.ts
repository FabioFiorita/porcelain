import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const duration = 30 * 24 * 60 * 60;
const name = 'porcelain_session';
const deviceName = 'porcelain_device';
/** Matches the device credential's own 90-day unused lifetime. */
const deviceDuration = 90 * 24 * 60 * 60;

function signature(value: string, token: string) {
  return createHmac('sha256', token)
    .update(`browser-session:${value}`)
    .digest('hex');
}

export function browserSessionValid(request: FastifyRequest, token: string) {
  if (request.headers['x-porcelain-browser'] !== '1') return false;
  const cookies = (request.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim());
  const values = cookies.filter((part) => part.startsWith(`${name}=`));
  if (values.length !== 1) return false;
  const value = values[0]?.slice(name.length + 1) ?? '';
  const match = /^(\d{13})\.([a-f0-9]{64})$/.exec(value);
  if (!match?.[1] || !match[2] || Number(match[1]) <= Date.now()) return false;
  return timingSafeEqual(
    Buffer.from(match[2]),
    Buffer.from(signature(match[1], token)),
  );
}

function readCookie(
  request: FastifyRequest,
  cookieName: string,
): string | null {
  const cookies = (request.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${cookieName}=`));
  return cookies.length === 1
    ? (cookies[0]?.slice(cookieName.length + 1) ?? null)
    : null;
}

/** The device credential as the browser holds it: HttpOnly, so no script reads it. */
export function deviceCookie(request: FastifyRequest): string | null {
  return readCookie(request, deviceName);
}

export function setDeviceCookie(
  reply: FastifyReply,
  credential: string,
  secure: boolean,
) {
  reply.header(
    'Set-Cookie',
    `${deviceName}=${credential}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${deviceDuration}${secure ? '; Secure' : ''}`,
  );
}

export function setBrowserSession(
  reply: FastifyReply,
  token: string,
  secure: boolean,
) {
  const expires = String(Date.now() + duration * 1000);
  reply.header(
    'Set-Cookie',
    `${name}=${expires}.${signature(expires, token)}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${duration}${secure ? '; Secure' : ''}`,
  );
}

/**
 * Disconnect has to take every credential the browser holds. Clearing only the
 * session cookie would leave a paired device authenticating again on its next
 * request from the device cookie, which is the opposite of what the owner
 * pressed the button for.
 */
export function clearBrowserSession(reply: FastifyReply) {
  const expire = (cookie: string) =>
    `${cookie}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0`;
  reply.header('Set-Cookie', [expire(name), expire(deviceName)]);
}
