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
import type { EventPublisher } from '../ports/event-publisher.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';

const limits = {
  presenceGraceMs: 30 * 24 * 60 * 60 * 1000,
  folderEntries: 2000,
  discoveredRepositories: 50,
  discoveryFolders: 500,
  discoveryDepth: 3,
  discoverySkippedNames: ['node_modules', 'vendor', 'dist', 'build', 'target'],
  filePreferences: 2000,
};

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
  const inventory = createInventoryStore(deps.session);
  const worktreePresence = createWorktreePresenceStore(deps.session);
  const filePreference = createFilePreferenceStore(deps.session);
  const projectFolderReader =
    deps.projectFolderReader ?? new FilesystemProjectFolderReader();
  const projectRepositoryReader = new GitProjectRepositoryReader(deps.git);
  const { worktreeDirectory } = deps;

  const listRegisteredProjects = new ListRegisteredProjectsService(inventory);
  const listProjectWorktrees = new ListProjectWorktreesService(
    worktreeDirectory,
  );
  const updateProjectAvailability = new UpdateProjectAvailabilityService(
    inventory,
  );
  const recordWorktreePresence = new RecordWorktreePresenceService(
    inventory,
    worktreePresence,
    deps.clock,
  );
  const readWorktreeStatuses = new ReadWorktreeStatusesService(
    deps.worktreeStatusStore,
  );

  return {
    readInventory: new ReadInventoryUseCase(
      listRegisteredProjects,
      new ListKnownWorktreesService(worktreeDirectory),
      readWorktreeStatuses,
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
      new MarkProjectsUnavailableService(inventory),
      listRegisteredProjects,
      listProjectWorktrees,
      updateProjectAvailability,
      recordWorktreePresence,
      lanes,
      laneKeys,
    ),
    registerProject: new RegisterProjectUseCase(
      new InspectProjectRepositoryService(projectRepositoryReader),
      new ListOtherProjectsService(inventory),
      listProjectWorktrees,
      new ReadRepositoryOriginService(projectRepositoryReader),
      new RegisterProjectService(inventory, deps.idSource),
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
      new RemoveProjectService(createProjectRemovalStore(deps.session)),
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
        {
          home: deps.projectHome,
          maxRepositories: limits.discoveredRepositories,
          maxFolders: limits.discoveryFolders,
          maxDepth: limits.discoveryDepth,
          maxEntries: limits.folderEntries,
          skippedNames: limits.discoverySkippedNames,
        },
      ),
      lanes,
      laneKeys,
    ),
    browseProjectFolders: new BrowseProjectFoldersUseCase(
      new BrowseProjectFoldersService(
        projectFolderReader,
        projectRepositoryReader,
        { home: deps.projectHome, maxEntries: limits.folderEntries },
      ),
      lanes,
      laneKeys,
    ),
    listFilePreferences: new ListFilePreferencesUseCase(
      new ListFilePreferencesService(inventory, filePreference),
      lanes,
    ),
    setFilePreference: new SetFilePreferenceUseCase(
      new SetFilePreferenceService(inventory, filePreference, {
        maxPreferences: limits.filePreferences,
      }),
      lanes,
      laneKeys,
      events,
    ),
    collectAbsentWorktrees: new CollectAbsentWorktreesUseCase(
      new CollectAbsentWorktreesService(worktreePresence, deps.clock, {
        graceMs: limits.presenceGraceMs,
      }),
      lanes,
      laneKeys,
    ),
  };
}
