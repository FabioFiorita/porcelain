import { Redacted } from 'effect';

export type Transport = (path: string, init?: RequestInit) => Promise<Response>;

export function remoteTransport(
  address: string,
  credential: Redacted.Redacted<string> | undefined,
  send: (input: URL, init: RequestInit) => Promise<Response>,
): Transport {
  return (input, init) => {
    const url = new URL(input, address);
    const headers = new Headers(init?.headers);
    if (credential && url.pathname !== '/api/health')
      headers.set('authorization', `Bearer ${Redacted.value(credential)}`);
    return send(url, {
      ...init,
      headers,
      mode: 'cors',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
    });
  };
}
