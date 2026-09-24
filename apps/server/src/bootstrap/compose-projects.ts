import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { GitFactory } from '@porcelain/git/discovery';
import type {
  InventoryStore,
  ProjectFolderReader,
  WorktreeStatusStore,
} from '@porcelain/projects/ports';
import {
  BrowseProjectFoldersService,
  CollectAbsentWorktreesService,
  CompareKnownWorktreesService,
  ComposeInventoryService,
  ComposeProjectReportService,
  DiscoverProjectsService,
  FindWorktreeByPathService,
  ForgetProjectWorktreesService,
  InspectProjectRepositoryService,
  ListFilePreferencesService,
  ListKnownWorktreesService,
  ListOtherProjectsService,
  ListProjectWorktreesService,
  ListRegisteredProjectsService,
  MarkProjectsUnavailableService,
  ReadRepositoryOriginService,
  ReadWorktreeStatusesService,
  RecordWorktreePresenceService,
  RegisterProjectService,
  RemoveProjectService,
  RenameProjectService,
  SetFilePreferenceService,
  UpdateProjectAvailabilityService,
} from '@porcelain/projects/services';
import {
  createFilePreferenceStore,
  createProjectRemovalStore,
  createWorktreePresenceStore,
} from '@porcelain/storage/projects';
import { GitProjectRepositoryReader } from '../adapters/projects/git-project-repository-reader.ts';
import type { GitProjectWorktreeReader } from '../adapters/projects/git-project-worktree-reader.ts';
import { BrowseProjectFoldersUseCase } from '../use-cases/projects/browse-project-folders.ts';
import { CollectAbsentWorktreesUseCase } from '../use-cases/projects/collect-absent-worktrees.ts';
import { DiscoverProjectsUseCase } from '../use-cases/projects/discover-projects.ts';
import { ListFilePreferencesUseCase } from '../use-cases/projects/list-file-preferences.ts';
import { ReadInventoryUseCase } from '../use-cases/projects/read-inventory.ts';
import { RefreshInventoryUseCase } from '../use-cases/projects/refresh-inventory.ts';
import { RegisterProjectUseCase } from '../use-cases/projects/register-project.ts';
import { RemoveProjectUseCase } from '../use-cases/projects/remove-project.ts';
import { RenameProjectUseCase } from '../use-cases/projects/rename-project.ts';
import { ResolveWorktreeByPathUseCase } from '../use-cases/projects/resolve-worktree-by-path.ts';
import { SetFilePreferenceUseCase } from '../use-cases/projects/set-file-preference.ts';
import type { ComposeContext } from './compose-context.ts';

export type ProjectsAdapters = {
  readEnvironment: ReadEnvironmentService;
  git: GitFactory;
  inventoryStore: InventoryStore;
  worktreeStatusStore: WorktreeStatusStore;
  projectFolderReader: ProjectFolderReader;
  worktreeDirectory: GitProjectWorktreeReader;
};

export function composeProjects(
  context: ComposeContext,
  adapters: ProjectsAdapters,
) {
  const { session, lanes, laneKeys, events, clock, ids, settings } = context;
  const limits = settings.limits.projects;
  const inventory = adapters.inventoryStore;
  const worktreePresence = createWorktreePresenceStore(session);
  const filePreference = createFilePreferenceStore(session);
  const { projectFolderReader, worktreeDirectory } = adapters;
  const projectRepositoryReader = new GitProjectRepositoryReader(adapters.git);

  const listRegisteredProjects = new ListRegisteredProjectsService(inventory);
  const listKnownWorktrees = new ListKnownWorktreesService(worktreeDirectory);
  const listProjectWorktrees = new ListProjectWorktreesService(
    worktreeDirectory,
  );
  const updateProjectAvailability = new UpdateProjectAvailabilityService(
    inventory,
  );
  const recordWorktreePresence = new RecordWorktreePresenceService(
    inventory,
    worktreePresence,
    clock,
  );
  const readWorktreeStatuses = new ReadWorktreeStatusesService(
    adapters.worktreeStatusStore,
  );

  return {
    readInventory: new ReadInventoryUseCase(
      listRegisteredProjects,
      listKnownWorktrees,
      readWorktreeStatuses,
      adapters.readEnvironment,
      new ComposeInventoryService(),
      lanes,
      laneKeys,
    ),
    resolveWorktreeByPath: new ResolveWorktreeByPathUseCase(
      listRegisteredProjects,
      listProjectWorktrees,
      new FindWorktreeByPathService(),
      lanes,
      laneKeys,
    ),
    refreshInventory: new RefreshInventoryUseCase(
      listRegisteredProjects,
      listKnownWorktrees,
      listProjectWorktrees,
      new MarkProjectsUnavailableService(inventory),
      updateProjectAvailability,
      recordWorktreePresence,
      new CompareKnownWorktreesService(),
      lanes,
      laneKeys,
      events,
    ),
    registerProject: new RegisterProjectUseCase(
      new InspectProjectRepositoryService(projectRepositoryReader),
      new ListOtherProjectsService(inventory),
      listProjectWorktrees,
      new ReadRepositoryOriginService(projectRepositoryReader),
      new RegisterProjectService(inventory, ids),
      updateProjectAvailability,
      recordWorktreePresence,
      readWorktreeStatuses,
      new ComposeProjectReportService(),
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
      new RemoveProjectService(createProjectRemovalStore(session)),
      new ForgetProjectWorktreesService(worktreeDirectory),
      lanes,
      laneKeys,
      events,
    ),
    discoverProjects: new DiscoverProjectsUseCase(
      new DiscoverProjectsService(
        inventory,
        projectFolderReader,
        projectRepositoryReader,
        { home: settings.projectHome, ...limits.discovery },
      ),
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
      new ListFilePreferencesService(inventory, filePreference),
      lanes,
    ),
    setFilePreference: new SetFilePreferenceUseCase(
      new SetFilePreferenceService(
        inventory,
        filePreference,
        limits.filePreferences,
      ),
      lanes,
      laneKeys,
      events,
    ),
    collectAbsentWorktrees: new CollectAbsentWorktreesUseCase(
      new CollectAbsentWorktreesService(
        worktreePresence,
        clock,
        limits.presence,
      ),
      lanes,
      laneKeys,
    ),
  };
}
