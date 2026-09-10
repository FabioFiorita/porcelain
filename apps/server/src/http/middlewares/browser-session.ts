import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const duration = 30 * 24 * 60 * 60;
const name = 'porcelain_session';

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

export function clearBrowserSession(reply: FastifyReply) {
  reply.header(
    'Set-Cookie',
    `${name}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0`,
  );
}
