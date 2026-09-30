import { reportUnauthorized } from './unauthorized';

export type Transport = (path: string, init?: RequestInit) => Promise<Response>;

export function browserTransport(
  transport: typeof fetch,
  options: { reportUnauthorized?: boolean } = {},
): Transport {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.delete('authorization');
    headers.set('x-porcelain-browser', '1');
    const response = await transport(input, {
      ...init,
      headers,
      credentials: 'same-origin',
    });
    if (
      response.status === 401 &&
      !input.endsWith('/api/pair') &&
      options.reportUnauthorized !== false
    )
      reportUnauthorized();
    return response;
  };
}

function crossOrigin(target: URL, init: RequestInit) {
  return fetch(target, {
    ...init,
    mode: 'cors',
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
  });
}

export function remoteTransport(
  address: string,
  credential?: string,
): Transport {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if (credential) headers.set('authorization', `Bearer ${credential}`);
    return crossOrigin(new URL(input, address), { ...init, headers });
  };
}
