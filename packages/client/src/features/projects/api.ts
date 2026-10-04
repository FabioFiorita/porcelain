import { readInventoryEndpoint } from '@porcelain/contracts/projects';

import { perConnection } from '../../shared/api/per-connection.ts';
import {
  requestEndpoint,
  type EndpointArguments,
} from '../../shared/api/request.ts';
import type { Transport } from '../../shared/api/transport.ts';

function createInventoryApi(transport: Transport) {
  return {
    read: ({ signal }: EndpointArguments<typeof readInventoryEndpoint>) =>
      requestEndpoint(transport, readInventoryEndpoint, { signal }),
  };
}

export const inventoryApi = perConnection(createInventoryApi);

import {
  browseProjectFoldersEndpoint,
  registerProjectEndpoint,
  renameProjectEndpoint,
  removeProjectEndpoint,
  listFilePreferencesEndpoint,
  setFilePreferenceEndpoint,
} from '@porcelain/contracts/projects';
import { type SetFilePreferenceRequest } from '@porcelain/contracts/projects';

function createProjectsApi(transport: Transport) {
  return {
    inventory: {
      read: inventoryApi({ transport }).read,
      browse: ({
        signal,
        path,
      }: {
        signal: AbortSignal;
        path?: string | undefined;
      }) =>
        requestEndpoint(transport, browseProjectFoldersEndpoint, {
          query: { path },
          signal,
        }),
      register: ({ signal, path }: { signal: AbortSignal; path: string }) =>
        requestEndpoint(transport, registerProjectEndpoint, {
          body: { path },
          signal,
        }),
      rename: ({
        signal,
        projectId,
        name,
      }: {
        signal: AbortSignal;
        projectId: string;
        name: string;
      }) =>
        requestEndpoint(transport, renameProjectEndpoint, {
          params: { projectId },
          body: { name },
          signal,
        }),
      remove: ({
        signal,
        projectId,
      }: {
        signal: AbortSignal;
        projectId: string;
      }) =>
        requestEndpoint(transport, removeProjectEndpoint, {
          params: { projectId },
          signal,
        }),
    },
    filePreferences: {
      list: ({
        signal,
        projectId,
      }: {
        signal: AbortSignal;
        projectId: string;
      }) =>
        requestEndpoint(transport, listFilePreferencesEndpoint, {
          params: { projectId },
          signal,
        }),
      set: ({
        signal,
        projectId,
        input,
      }: {
        signal: AbortSignal;
        projectId: string;
        input: SetFilePreferenceRequest;
      }) =>
        requestEndpoint(transport, setFilePreferenceEndpoint, {
          params: { projectId },
          body: input,
          signal,
        }),
    },
  };
}

export const projectsApi = perConnection(createProjectsApi);
