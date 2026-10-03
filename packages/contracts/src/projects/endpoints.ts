import { defineEndpoint } from '../shared/endpoint.ts';
import {
  listFilePreferencesResponseSchema,
  setFilePreferenceRequestSchema,
  setFilePreferenceResponseSchema,
} from './file-preferences.ts';
import {
  browseProjectFoldersQuerySchema,
  browseProjectFoldersResponseSchema,
  listFilePreferencesParamsSchema,
  readInventoryResponseSchema,
  registerProjectRequestSchema,
  registerProjectResponseSchema,
  removeProjectParamsSchema,
  removeProjectResponseSchema,
  renameProjectParamsSchema,
  renameProjectRequestSchema,
  renameProjectResponseSchema,
  setFilePreferenceParamsSchema,
} from './inventory.ts';

export const browseProjectFoldersEndpoint = defineEndpoint({
  method: 'GET',
  path: '/projects/folders',
  schema: {
    querystring: browseProjectFoldersQuerySchema,
    response: {
      200: browseProjectFoldersResponseSchema,
    },
  },
  errors: {},
});

export const listFilePreferencesEndpoint = defineEndpoint({
  method: 'GET',
  path: '/projects/:projectId/file-preferences',
  schema: {
    params: listFilePreferencesParamsSchema,
    response: { 200: listFilePreferencesResponseSchema },
  },
  errors: {},
});

export const readInventoryEndpoint = defineEndpoint({
  method: 'GET',
  path: '/inventory',
  schema: {
    response: { 200: readInventoryResponseSchema },
  },
  errors: {},
});

export const registerProjectEndpoint = defineEndpoint({
  method: 'POST',
  path: '/projects',
  schema: {
    body: registerProjectRequestSchema,
    response: { 200: registerProjectResponseSchema },
  },
  errors: {},
});

export const removeProjectEndpoint = defineEndpoint({
  method: 'DELETE',
  path: '/projects/:projectId',
  schema: {
    params: removeProjectParamsSchema,
    response: { 200: removeProjectResponseSchema },
  },
  errors: {},
});

export const renameProjectEndpoint = defineEndpoint({
  method: 'PATCH',
  path: '/projects/:projectId',
  schema: {
    params: renameProjectParamsSchema,
    body: renameProjectRequestSchema,
    response: { 200: renameProjectResponseSchema },
  },
  errors: {},
});

export const setFilePreferenceEndpoint = defineEndpoint({
  method: 'PUT',
  path: '/projects/:projectId/file-preferences',
  schema: {
    params: setFilePreferenceParamsSchema,
    body: setFilePreferenceRequestSchema,
    response: { 200: setFilePreferenceResponseSchema },
  },
  errors: {},
});
