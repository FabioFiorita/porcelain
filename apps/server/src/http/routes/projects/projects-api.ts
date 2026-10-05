import { ProjectsApi } from '@porcelain/contracts/projects';
import type { Context } from 'effect';
import { Layer } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { effectRoutes } from '../../effect-bridge.ts';
import { type BrowseProjectFoldersUseCase } from '../../../use-cases/projects/browse-project-folders.ts';
import { type ListFilePreferencesUseCase } from '../../../use-cases/projects/list-file-preferences.ts';
import { type ReadInventoryUseCase } from '../../../use-cases/projects/read-inventory.ts';
import { type RegisterProjectUseCase } from '../../../use-cases/projects/register-project.ts';
import { type RemoveProjectUseCase } from '../../../use-cases/projects/remove-project.ts';
import { type RenameProjectUseCase } from '../../../use-cases/projects/rename-project.ts';
import { type SetFilePreferenceUseCase } from '../../../use-cases/projects/set-file-preference.ts';

type ProjectsUseCases = {
  browseProjectFolders: Context.Service.Shape<
    typeof BrowseProjectFoldersUseCase
  >;
  listFilePreferences: Context.Service.Shape<typeof ListFilePreferencesUseCase>;
  readInventory: Context.Service.Shape<typeof ReadInventoryUseCase>;
  registerProject: Context.Service.Shape<typeof RegisterProjectUseCase>;
  removeProject: Context.Service.Shape<typeof RemoveProjectUseCase>;
  renameProject: Context.Service.Shape<typeof RenameProjectUseCase>;
  setFilePreference: Context.Service.Shape<typeof SetFilePreferenceUseCase>;
};

export function projectsRoutes(useCases: ProjectsUseCases) {
  const handlers = HttpApiBuilder.group(ProjectsApi, 'projects', (handlers) =>
    handlers
      .handle('browseProjectFolders', ({ query }) =>
        useCases.browseProjectFolders.execute(query),
      )
      .handle('listFilePreferences', ({ params }) =>
        useCases.listFilePreferences.execute(params),
      )
      .handle('readInventory', () => useCases.readInventory.execute())
      .handle('registerProject', ({ payload }) =>
        useCases.registerProject.execute(payload),
      )
      .handle('removeProject', ({ params }) =>
        useCases.removeProject.execute(params),
      )
      .handle('renameProject', ({ params, payload }) =>
        useCases.renameProject.execute({ ...params, ...payload }),
      )
      .handle('setFilePreference', ({ params, payload }) =>
        useCases.setFilePreference.execute({ ...params, ...payload }),
      ),
  );
  return effectRoutes(
    ProjectsApi,
    HttpApiBuilder.layer(ProjectsApi).pipe(Layer.provide(handlers)),
  );
}
