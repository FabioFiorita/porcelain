import type { GitFactory } from '@porcelain/git/discovery';
import type { Clock, IdSource } from '@porcelain/kernel/ports';
import type {
  ProjectFolderReader,
  WorktreeStatusStore,
} from '@porcelain/projects/ports';
import {
  BrowseProjectFoldersService,
  CollectAbsentWorktreesService,
  ComposeInventoryService,
  ComposeProjectReportService,
  DiscoverProjectsService,
  ForgetProjectWorktreesService,
  InspectProjectRepositoryService,
  ListFilePreferencesService,
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
  ResolveWorktreeByPathService,
  SetFilePreferenceService,
  UpdateProjectAvailabilityService,
} from '@porcelain/projects/services';
import type { StorageSession } from '@porcelain/storage';
import {
  createFilePreferenceStore,
  createInventoryStore,
  createProjectRemovalStore,
  createWorktreePresenceStore,
} from '@porcelain/storage/projects';
import { FilesystemProjectFolderReader } from '../adapters/projects/filesystem-project-folder-reader.ts';
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
import type { EventPublisher } from '../runtime/event-publisher.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';

export type ProjectsDependencies = {
  session: StorageSession;
  lanes: Lanes;
  laneKeys: LaneKeys;
  events: EventPublisher;
  git: GitFactory;
  clock: Clock;
  idSource: IdSource;
  worktreeStatusStore: WorktreeStatusStore;
  projectFolderReader?: ProjectFolderReader | undefined;
  projectHome: string;
  worktreeDirectory: GitProjectWorktreeReader;
};

export function composeProjects(deps: ProjectsDependencies) {
  const { lanes, laneKeys, events } = deps;
  const inventoryStore = createInventoryStore(deps.session);
  const worktreePresenceStore = createWorktreePresenceStore(deps.session);
  const filePreferenceStore = createFilePreferenceStore(deps.session);
  const projectFolderReader =
    deps.projectFolderReader ?? new FilesystemProjectFolderReader();
  const projectRepositoryReader = new GitProjectRepositoryReader(deps.git);
  const { worktreeDirectory } = deps;

  const listRegisteredProjects = new ListRegisteredProjectsService(
    inventoryStore,
  );
  const listProjectWorktrees = new ListProjectWorktreesService(
    worktreeDirectory,
  );
  const updateProjectAvailability = new UpdateProjectAvailabilityService(
    inventoryStore,
  );
  const recordWorktreePresence = new RecordWorktreePresenceService(
    inventoryStore,
    worktreePresenceStore,
    deps.clock,
  );
  const readWorktreeStatuses = new ReadWorktreeStatusesService(
    deps.worktreeStatusStore,
  );

  return {
    readInventory: new ReadInventoryUseCase(
      listRegisteredProjects,
      listProjectWorktrees,
      updateProjectAvailability,
      recordWorktreePresence,
      readWorktreeStatuses,
      new ComposeInventoryService(inventoryStore),
      lanes,
      laneKeys,
    ),
    resolveWorktreeByPath: new ResolveWorktreeByPathUseCase(
      listRegisteredProjects,
      listProjectWorktrees,
      new ResolveWorktreeByPathService(),
      lanes,
      laneKeys,
    ),
    refreshInventory: new RefreshInventoryUseCase(
      new MarkProjectsUnavailableService(inventoryStore),
      listRegisteredProjects,
      listProjectWorktrees,
      updateProjectAvailability,
      recordWorktreePresence,
      lanes,
      laneKeys,
    ),
    registerProject: new RegisterProjectUseCase(
      new InspectProjectRepositoryService(projectRepositoryReader),
      new ListOtherProjectsService(inventoryStore),
      listProjectWorktrees,
      new ReadRepositoryOriginService(projectRepositoryReader),
      new RegisterProjectService(inventoryStore, deps.idSource),
      readWorktreeStatuses,
      new ComposeProjectReportService(),
      lanes,
      laneKeys,
      events,
    ),
    renameProject: new RenameProjectUseCase(
      new RenameProjectService(inventoryStore),
      lanes,
      laneKeys,
      events,
    ),
    removeProject: new RemoveProjectUseCase(
      new RemoveProjectService(createProjectRemovalStore(deps.session)),
      new ForgetProjectWorktreesService(worktreeDirectory),
      lanes,
      laneKeys,
      events,
    ),
    discoverProjects: new DiscoverProjectsUseCase(
      new DiscoverProjectsService(
        inventoryStore,
        projectFolderReader,
        projectRepositoryReader,
        { home: deps.projectHome },
      ),
      lanes,
      laneKeys,
    ),
    browseProjectFolders: new BrowseProjectFoldersUseCase(
      new BrowseProjectFoldersService(
        projectFolderReader,
        projectRepositoryReader,
        { home: deps.projectHome },
      ),
      lanes,
      laneKeys,
    ),
    listFilePreferences: new ListFilePreferencesUseCase(
      new ListFilePreferencesService(inventoryStore, filePreferenceStore),
      lanes,
    ),
    setFilePreference: new SetFilePreferenceUseCase(
      new SetFilePreferenceService(inventoryStore, filePreferenceStore),
      lanes,
      events,
    ),
    collectAbsentWorktrees: new CollectAbsentWorktreesUseCase(
      new CollectAbsentWorktreesService(worktreePresenceStore, deps.clock),
      lanes,
      laneKeys,
    ),
  };
}
