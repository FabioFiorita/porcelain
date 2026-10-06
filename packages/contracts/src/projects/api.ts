import { RepositoryUnavailableError } from '@porcelain/kernel/errors';
import { environmentUnavailable } from '../shared/environment-failure.ts';
import { PairedRequest } from '../shared/http-caller.ts';
import { porcelainApi } from '../shared/http-api.ts';
import { HttpApiEndpoint, HttpApiGroup } from 'effect/http-api';
import {
  FilePreferenceLimitError,
  FolderNotFoundError,
  FolderNotReadableError,
  ProjectNotFoundError,
  UnsupportedFolderNameError,
} from '@porcelain/projects/errors';
import { httpFailure } from '../shared/http-failure.ts';
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

const projectNotFound = httpFailure(ProjectNotFoundError, 'NotFound');
export class ProjectsApi extends porcelainApi.add(
  HttpApiGroup.make('projects')
    .add(
      HttpApiEndpoint.get('browseProjectFolders', '/api/projects/folders', {
        disableCodecs: true,
        query: browseProjectFoldersQuerySchema.fields,
        success: browseProjectFoldersResponseSchema,
        error: [
          httpFailure(FolderNotFoundError, 'NotFound'),
          httpFailure(FolderNotReadableError, 'UnprocessableEntity'),
          httpFailure(UnsupportedFolderNameError, 'UnprocessableEntity'),
        ],
      }),
      HttpApiEndpoint.get('readInventory', '/api/inventory', {
        disableCodecs: true,
        success: readInventoryResponseSchema,
        error: environmentUnavailable,
      }),
      HttpApiEndpoint.get(
        'listFilePreferences',
        '/api/projects/:projectId/file-preferences',
        {
          disableCodecs: true,
          params: listFilePreferencesParamsSchema,
          success: listFilePreferencesResponseSchema,
          error: projectNotFound,
        },
      ),
      HttpApiEndpoint.post('registerProject', '/api/projects', {
        disableCodecs: true,
        payload: registerProjectRequestSchema,
        success: registerProjectResponseSchema,
        error: [
          projectNotFound,
          httpFailure(RepositoryUnavailableError, 'UnprocessableEntity', {
            message: 'Repository could not be inspected',
          }),
        ],
      }),
      HttpApiEndpoint.delete('removeProject', '/api/projects/:projectId', {
        disableCodecs: true,
        params: removeProjectParamsSchema,
        success: removeProjectResponseSchema,
        error: projectNotFound,
      }),
      HttpApiEndpoint.patch('renameProject', '/api/projects/:projectId', {
        disableCodecs: true,
        params: renameProjectParamsSchema,
        payload: renameProjectRequestSchema,
        success: renameProjectResponseSchema,
        error: projectNotFound,
      }),
      HttpApiEndpoint.put(
        'setFilePreference',
        '/api/projects/:projectId/file-preferences',
        {
          disableCodecs: true,
          params: setFilePreferenceParamsSchema,
          payload: setFilePreferenceRequestSchema,
          success: setFilePreferenceResponseSchema,
          error: [
            projectNotFound,
            httpFailure(FilePreferenceLimitError, 'Conflict', {
              message: 'File preference limit reached',
            }),
          ],
        },
      ),
    )
    .middleware(PairedRequest),
) {}
