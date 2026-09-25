import {
  browseProjectFoldersResponseSchema,
  discoverProjectsResponseSchema,
  readInventoryResponseSchema,
  registerProjectResponseSchema,
  removeProjectResponseSchema,
  renameProjectResponseSchema,
} from '@porcelain/contracts/projects';
import { requestJson } from '../../../shared/api/request';
import type { InventoryPort } from './inventory-port';

export function createInventoryLive(transport: typeof fetch): InventoryPort {
  return {
    read: ({ signal }) =>
      requestJson(transport, '/api/inventory', readInventoryResponseSchema, {
        signal,
      }),
    discover: ({ signal }) =>
      requestJson(
        transport,
        '/api/projects/discover',
        discoverProjectsResponseSchema,
        { signal },
      ),
    browse: ({ signal, path }) =>
      requestJson(
        transport,
        path === undefined
          ? '/api/projects/folders'
          : `/api/projects/folders?${new URLSearchParams({ path })}`,
        browseProjectFoldersResponseSchema,
        { signal },
      ),
    register: ({ signal, path }) =>
      requestJson(transport, '/api/projects', registerProjectResponseSchema, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path }),
        signal,
      }),
    remove: ({ signal, projectId }) =>
      requestJson(
        transport,
        `/api/projects/${encodeURIComponent(projectId)}`,
        removeProjectResponseSchema,
        { method: 'DELETE', signal },
      ),
    rename: ({ signal, projectId, name }) =>
      requestJson(
        transport,
        `/api/projects/${encodeURIComponent(projectId)}`,
        renameProjectResponseSchema,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
          signal,
        },
      ),
  };
}
