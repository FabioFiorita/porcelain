import {
  browseProjectFoldersResponseSchema,
  discoverProjectsResponseSchema,
  listFilePreferencesResponseSchema,
  readInventoryResponseSchema,
  registerProjectRequestSchema,
  registerProjectResponseSchema,
  removeProjectResponseSchema,
  renameProjectRequestSchema,
  renameProjectResponseSchema,
  setFilePreferenceRequestSchema,
  setFilePreferenceResponseSchema,
  type SetFilePreferenceRequest,
} from '@porcelain/contracts/projects';
import { requestJson } from '@/shared/api/request';
import { browserTransport } from '@/shared/api/transport';

function createProjectsApi(transport: typeof fetch) {
  const preferencesPath = (projectId: string) =>
    `/api/projects/${encodeURIComponent(projectId)}/file-preferences`;
  return {
    inventory: {
      read: (signal: AbortSignal) =>
        requestJson(transport, '/api/inventory', readInventoryResponseSchema, {
          signal,
        }),
      discover: (signal: AbortSignal) =>
        requestJson(
          transport,
          '/api/projects/discover',
          discoverProjectsResponseSchema,
          { signal },
        ),
      browse: (signal: AbortSignal, path?: string) =>
        requestJson(
          transport,
          path === undefined
            ? '/api/projects/folders'
            : `/api/projects/folders?${new URLSearchParams({ path })}`,
          browseProjectFoldersResponseSchema,
          { signal },
        ),
      register: (signal: AbortSignal, path: string) =>
        requestJson(transport, '/api/projects', registerProjectResponseSchema, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(registerProjectRequestSchema.parse({ path })),
          signal,
        }),
      rename: (signal: AbortSignal, projectId: string, name: string) =>
        requestJson(
          transport,
          `/api/projects/${encodeURIComponent(projectId)}`,
          renameProjectResponseSchema,
          {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(renameProjectRequestSchema.parse({ name })),
            signal,
          },
        ),
      remove: (signal: AbortSignal, projectId: string) =>
        requestJson(
          transport,
          `/api/projects/${encodeURIComponent(projectId)}`,
          removeProjectResponseSchema,
          { method: 'DELETE', signal },
        ),
    },
    filePreferences: {
      list: (signal: AbortSignal, projectId: string) =>
        requestJson(
          transport,
          preferencesPath(projectId),
          listFilePreferencesResponseSchema,
          { signal },
        ),
      set: (
        signal: AbortSignal,
        projectId: string,
        input: SetFilePreferenceRequest,
      ) =>
        requestJson(
          transport,
          preferencesPath(projectId),
          setFilePreferenceResponseSchema,
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(setFilePreferenceRequestSchema.parse(input)),
            signal,
          },
        ),
    },
  };
}

export const projectsApi = createProjectsApi(browserTransport(fetch));
