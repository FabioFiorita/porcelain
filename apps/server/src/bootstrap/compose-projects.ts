import type { ProjectFolderReader } from '@porcelain/projects/ports';
import {
  BrowseProjectFoldersService,
  CheckProjectService,
  CollectAbsentWorktreesService,
  DiscoverProjectsService,
  FindProjectService,
  ForgetProjectRecordsService,
  InspectProjectRepositoryService,
  ListExpiredWorktreesService,
  ListFilePreferencesService,
  ListProjectWorktreesService,
  MarkProjectsUnavailableService,
  ReadRepositoryOriginService,
  RecordWorktreeCatalogService,
  RecordWorktreePresenceService,
  RegisterProjectService,
  RemoveProjectService,
  RenameProjectService,
  SetFilePreferenceService,
  UpdateProjectAvailabilityService,
} from '@porcelain/projects/services';
import { GitProjectRepositoryReader } from '../adapters/projects/git-project-repository-reader.ts';
import { BrowseProjectFoldersUseCase } from '../use-cases/projects/browse-project-folders.ts';
import { CheckWorktreeUseCase } from '../use-cases/projects/check-worktree.ts';
import { CollectAbsentWorktreesUseCase } from '../use-cases/projects/collect-absent-worktrees.ts';
import { DiscoverProjectsUseCase } from '../use-cases/projects/discover-projects.ts';
import { FindWorktreeByPathUseCase } from '../use-cases/projects/find-worktree-by-path.ts';
import { ListFilePreferencesUseCase } from '../use-cases/projects/list-file-preferences.ts';
import { ReadInventoryUseCase } from '../use-cases/projects/read-inventory.ts';
import { RefreshInventoryUseCase } from '../use-cases/projects/refresh-inventory.ts';
import { RegisterProjectUseCase } from '../use-cases/projects/register-project.ts';
import { RemoveProjectUseCase } from '../use-cases/projects/remove-project.ts';
import { RenameProjectUseCase } from '../use-cases/projects/rename-project.ts';
import { SetFilePreferenceUseCase } from '../use-cases/projects/set-file-preference.ts';
import type { ComposeContext } from './compose-context.ts';
import type { Shared } from './compose-shared.ts';
import type { Stores } from './compose-stores.ts';

export type ProjectsDependencies = {
  stores: Stores;
  shared: Shared;
  projectFolderReader: ProjectFolderReader;
};

export function composeProjects(
  context: ComposeContext,
  dependencies: ProjectsDependencies,
) {
  const { lanes, laneKeys, events, clock, ids, settings } = context;
  const limits = settings.limits.projects;
  const { stores, shared, projectFolderReader } = dependencies;
  const inventory = stores.inventory;
  const worktreePresence = stores.worktreePresence;
  const filePreference = stores.filePreferences;
  const { catalog, readWorktreeStatuses } = shared;
  const projectRepositoryReader = new GitProjectRepositoryReader(shared.git);

  const { listRegisteredProjects, listKnownWorktrees } = shared;
  const listProjectWorktrees = new ListProjectWorktreesService(
    shared.worktreeListing,
    catalog,
  );
  const updateProjectAvailability = new UpdateProjectAvailabilityService(
    inventory,
  );
  const checkProject = new CheckProjectService(inventory);
  const recordWorktreePresence = new RecordWorktreePresenceService(
    inventory,
    worktreePresence,
    clock,
  );

  const refreshInventory = new RefreshInventoryUseCase(
    listRegisteredProjects,
    listKnownWorktrees,
    listProjectWorktrees,
    new MarkProjectsUnavailableService(inventory),
    updateProjectAvailability,
    recordWorktreePresence,
    new RecordWorktreeCatalogService(catalog, clock),
    lanes,
    laneKeys,
    events,
  );

  return {
    readInventory: new ReadInventoryUseCase(
      listRegisteredProjects,
      listKnownWorktrees,
      readWorktreeStatuses,
      shared.readEnvironment,
      lanes,
      laneKeys,
    ),
    findWorktreeByPath: new FindWorktreeByPathUseCase(
      listRegisteredProjects,
      listKnownWorktrees,
      refreshInventory,
      lanes,
      laneKeys,
    ),
    refreshInventory,
    checkWorktree: new CheckWorktreeUseCase(
      shared.checkWorktreeService,
      shared.checkRefreshedWorktree,
      refreshInventory,
    ),
    registerProject: new RegisterProjectUseCase(
      new InspectProjectRepositoryService(projectRepositoryReader),
      new ReadRepositoryOriginService(projectRepositoryReader),
      new RegisterProjectService(inventory, ids),
      refreshInventory,
      listRegisteredProjects,
      listKnownWorktrees,
      readWorktreeStatuses,
      lanes,
      laneKeys,
      events,
    ),
    renameProject: new RenameProjectUseCase(
      new RenameProjectService(inventory),
      lanes,
      laneKeys,
      events,
    ),
    removeProject: new RemoveProjectUseCase(
      new FindProjectService(inventory),
      new ForgetProjectRecordsService(worktreePresence, filePreference),
      new RemoveProjectService(inventory),
      refreshInventory,
      lanes,
      laneKeys,
      events,
    ),
    discoverProjects: new DiscoverProjectsUseCase(
      new DiscoverProjectsService(
        projectFolderReader,
        projectRepositoryReader,
        { home: settings.projectHome, ...limits.discovery },
      ),
      listRegisteredProjects,
      lanes,
      laneKeys,
    ),
    browseProjectFolders: new BrowseProjectFoldersUseCase(
      new BrowseProjectFoldersService(
        projectFolderReader,
        projectRepositoryReader,
        { home: settings.projectHome, ...limits.folders },
      ),
      lanes,
      laneKeys,
    ),
    listFilePreferences: new ListFilePreferencesUseCase(
      checkProject,
      new ListFilePreferencesService(filePreference),
      lanes,
      laneKeys,
    ),
    setFilePreference: new SetFilePreferenceUseCase(
      checkProject,
      new SetFilePreferenceService(filePreference, limits.filePreferences),
      lanes,
      laneKeys,
      events,
    ),
    collectAbsentWorktrees: new CollectAbsentWorktreesUseCase(
      new ListExpiredWorktreesService(
        worktreePresence,
        inventory,
        clock,
        limits.presence,
      ),
      new CollectAbsentWorktreesService(
        worktreePresence,
        clock,
        limits.presence,
      ),
      lanes,
      laneKeys,
      events,
    ),
  };
}
