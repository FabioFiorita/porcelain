import { reportUnauthorized } from './unauthorized';

export function browserTransport(
  transport: typeof fetch,
  options: { reportUnauthorized?: boolean } = {},
): typeof fetch {
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
      !establishing(input) &&
      options.reportUnauthorized !== false
    )
      reportUnauthorized();
    return response;
  };
}

function establishing(input: Parameters<typeof fetch>[0]) {
  const path =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  return path.endsWith('/api/pair');
}

export function remoteTransport(
  address: string,
  credential?: string,
): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if (credential) headers.set('authorization', `Bearer ${credential}`);
    const path =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    return fetch(new URL(path, address), {
      ...init,
      headers,
      mode: 'cors',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
    });
  };
}
