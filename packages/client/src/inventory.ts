import {
  inventoryResponseSchema,
  projectDiscoveryResponseSchema,
  projectFolderResponseSchema,
  projectResponseSchema,
} from '@porcelain/contracts/inventory';
import { ConnectionError } from './errors/connection-error.ts';

type InventoryRequest = {
  endpoint: string;
  token: string;
  fetch: typeof fetch;
  signal: AbortSignal;
};

export async function readInventory(options: {
  endpoint: InventoryRequest['endpoint'];
  token: InventoryRequest['token'];
  fetch: InventoryRequest['fetch'];
  signal: InventoryRequest['signal'];
  refresh?: boolean;
}) {
  const transport = options.fetch;
  try {
    const response = await transport(
      options.endpoint +
        (options.refresh ? '/inventory/refresh' : '/inventory'),
      {
        method: options.refresh ? 'POST' : 'GET',
        headers: { authorization: `Bearer ${options.token}` },
        signal: options.signal,
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
      },
    );
    if (response.status === 401)
      throw new ConnectionError(
        'Access token was rejected. Check it and try again.',
      );
    if (!response.ok)
      throw new ConnectionError(
        'The environment could not complete the request. Try again.',
      );
    const parsed = inventoryResponseSchema.safeParse(await response.json());
    if (!parsed.success)
      throw new ConnectionError(
        'The server returned an incompatible inventory.',
      );
    return parsed.data;
  } catch (error) {
    if (options.signal.aborted) throw error;
    if (error instanceof ConnectionError) throw error;
    throw new ConnectionError(
      'Could not reach the environment. Check that the server is running.',
      { cause: error },
    );
  }
}

/** Register a repository path on the machine running the Porcelain server. */
export async function registerProject(
  options: InventoryRequest & { path: string },
) {
  try {
    const response = await options.fetch(`${options.endpoint}/projects`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ path: options.path }),
      signal: options.signal,
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
    });
    if (response.status === 401)
      throw new ConnectionError(
        'Access token was rejected. Disconnect and connect again.',
      );
    if (response.status === 400)
      throw new ConnectionError(
        'Enter an absolute path on the Porcelain server.',
      );
    if (response.status === 422)
      throw new ConnectionError(
        'That path is not an accessible Git repository on the Porcelain server.',
      );
    if (!response.ok)
      throw new ConnectionError(
        'The Porcelain server could not open that project. Check the path and try again.',
      );
    const parsed = projectResponseSchema.safeParse(await response.json());
    if (!parsed.success)
      throw new ConnectionError('The server returned an incompatible project.');
    return parsed.data;
  } catch (error) {
    if (options.signal.aborted) throw error;
    if (error instanceof ConnectionError) throw error;
    throw new ConnectionError(
      'Could not reach the Porcelain server. Check that it is running.',
      { cause: error },
    );
  }
}

export async function discoverProjects(options: InventoryRequest) {
  return readProjectLocation(
    options,
    '/projects/discover',
    projectDiscoveryResponseSchema,
  );
}

export async function browseProjectFolders(
  options: InventoryRequest & { path?: string },
) {
  const query =
    options.path === undefined
      ? ''
      : `?${new URLSearchParams({ path: options.path })}`;
  return readProjectLocation(
    options,
    `/projects/folders${query}`,
    projectFolderResponseSchema,
  );
}

async function readProjectLocation<T>(
  options: InventoryRequest,
  path: string,
  schema: { parse(value: unknown): T },
): Promise<T> {
  try {
    const response = await options.fetch(`${options.endpoint}${path}`, {
      headers: { authorization: `Bearer ${options.token}` },
      signal: options.signal,
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
    });
    if (response.status === 401)
      throw new ConnectionError(
        'Access token was rejected. Disconnect and connect again.',
      );
    if (response.status === 400)
      throw new ConnectionError(
        'Enter an absolute folder path on the Porcelain server.',
      );
    if (response.status === 404 || response.status === 422)
      throw new ConnectionError(
        'That folder could not be read on the Porcelain server. Check the path and permissions.',
      );
    if (!response.ok)
      throw new ConnectionError(
        'Could not load folders or repositories from the Porcelain server. Try again.',
      );
    return schema.parse(await response.json());
  } catch (error) {
    if (options.signal.aborted || error instanceof ConnectionError) throw error;
    throw new ConnectionError(
      'Could not load folders or repositories from the Porcelain server. Try again.',
      { cause: error },
    );
  }
}
