export type Transport = (path: string, init?: RequestInit) => Promise<Response>;

export function remoteTransport(
  address: string,
  credential: string | undefined,
  send: (input: URL, init: RequestInit) => Promise<Response>,
): Transport {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if (credential) headers.set('authorization', `Bearer ${credential}`);
    return send(new URL(input, address), {
      ...init,
      headers,
      mode: 'cors',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
    });
  };
}
