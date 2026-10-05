export {
  listFilePreferencesResponseSchema,
  type ListFilePreferencesResponse,
  type SetFilePreferenceRequest,
  type SetFilePreferenceResponse,
} from './file-preferences.ts';
export {
  browseProjectFoldersResponseSchema,
  readInventoryResponseSchema,
  registerProjectResponseSchema,
  renameProjectRequestSchema,
  type BrowseProjectFoldersQuery,
  type BrowseProjectFoldersResponse,
  type ListFilePreferencesParams,
  type ReadInventoryResponse,
  type RegisterProjectRequest,
  type RegisterProjectResponse,
  type RemoveProjectParams,
  type RemoveProjectResponse,
  type RenameProjectParams,
  type RenameProjectRequest,
  type RenameProjectResponse,
  type SetFilePreferenceParams,
} from './inventory.ts';
export {
  type FindWorktreeByPathRequest,
  type FindWorktreeByPathResponse,
} from './worktree-path.ts';
export { ProjectsApi } from './api.ts';

export {
  FilePreferenceLimitError,
  ProjectNotFoundError,
} from '@porcelain/projects/errors';
