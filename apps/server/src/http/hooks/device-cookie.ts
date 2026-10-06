import type { RequestContext } from '../request-context.ts';

const COOKIE_NAME = 'porcelain_device';
export function deviceCookie(
  context: RequestContext['Service'],
): string | null {
  const cookies = (context.request.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${COOKIE_NAME}=`));
  return cookies.length === 1
    ? (cookies[0]?.slice(COOKIE_NAME.length + 1) ?? null)
    : null;
}
export function setDeviceCookie(
  context: RequestContext['Service'],
  credential: string,
  secure: boolean,
  maxAgeSeconds: number,
) {
  context.response.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${credential}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`,
  );
}
export function clearDeviceCookie(context: RequestContext['Service']) {
  context.response.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0`,
  );
}
