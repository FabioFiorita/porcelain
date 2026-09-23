import type { GitFactory } from '@porcelain/git/discovery';
import type {
  Clock,
  IdSource,
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
import { ProjectFolderReaderAdapter } from '../adapters/projects/project-folder-reader-adapter.ts';
import { ProjectRepositoryReaderAdapter } from '../adapters/projects/project-repository-reader-adapter.ts';
import type { WorktreeAccessAdapter } from '../adapters/projects/worktree-access-adapter.ts';
import type { WorktreeDirectoryAdapter } from '../adapters/projects/worktree-directory-adapter.ts';
import { BrowseProjectFoldersController } from '../controllers/browse-project-folders-controller.ts';
import { CollectAbsentWorktreesController } from '../controllers/collect-absent-worktrees-controller.ts';
import { DiscoverProjectsController } from '../controllers/discover-projects-controller.ts';
import { ListFilePreferencesController } from '../controllers/list-file-preferences-controller.ts';
import { ReadInventoryController } from '../controllers/read-inventory-controller.ts';
import { RefreshInventoryController } from '../controllers/refresh-inventory-controller.ts';
import { RegisterProjectController } from '../controllers/register-project-controller.ts';
import { RemoveProjectController } from '../controllers/remove-project-controller.ts';
import { RenameProjectController } from '../controllers/rename-project-controller.ts';
import { SetFilePreferenceController } from '../controllers/set-file-preference-controller.ts';
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
  worktreeDirectory: WorktreeDirectoryAdapter;
  worktreeAccess: WorktreeAccessAdapter;
};

export function composeProjects(deps: ProjectsDependencies) {
  const { lanes, laneKeys, events } = deps;
  const inventoryStore = createInventoryStore(deps.session);
  const worktreePresenceStore = createWorktreePresenceStore(deps.session);
  const filePreferenceStore = createFilePreferenceStore(deps.session);
  const projectFolderReader =
    deps.projectFolderReader ?? new ProjectFolderReaderAdapter();
  const projectRepositoryReader = new ProjectRepositoryReaderAdapter(deps.git);
  const { worktreeDirectory, worktreeAccess } = deps;

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
    worktreeAccess,
    worktreeDirectory,
    readInventoryController: new ReadInventoryController(
      listRegisteredProjects,
      listProjectWorktrees,
      updateProjectAvailability,
      recordWorktreePresence,
      readWorktreeStatuses,
      new ComposeInventoryService(inventoryStore),
      lanes,
      laneKeys,
    ),
    refreshInventoryController: new RefreshInventoryController(
      new MarkProjectsUnavailableService(inventoryStore),
      listRegisteredProjects,
      listProjectWorktrees,
      updateProjectAvailability,
      recordWorktreePresence,
      lanes,
      laneKeys,
    ),
    registerProjectController: new RegisterProjectController(
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
    renameProjectController: new RenameProjectController(
      new RenameProjectService(inventoryStore),
      lanes,
      laneKeys,
      events,
    ),
    removeProjectController: new RemoveProjectController(
      new RemoveProjectService(createProjectRemovalStore(deps.session)),
      new ForgetProjectWorktreesService(worktreeDirectory),
      lanes,
      laneKeys,
      events,
    ),
    discoverProjectsController: new DiscoverProjectsController(
      new DiscoverProjectsService(
        inventoryStore,
        projectFolderReader,
        projectRepositoryReader,
        { home: deps.projectHome },
      ),
      lanes,
      laneKeys,
    ),
    browseProjectFoldersController: new BrowseProjectFoldersController(
      new BrowseProjectFoldersService(
        projectFolderReader,
        projectRepositoryReader,
        { home: deps.projectHome },
      ),
      lanes,
      laneKeys,
    ),
    listFilePreferencesController: new ListFilePreferencesController(
      new ListFilePreferencesService(inventoryStore, filePreferenceStore),
      lanes,
    ),
    setFilePreferenceController: new SetFilePreferenceController(
      new SetFilePreferenceService(inventoryStore, filePreferenceStore),
      lanes,
      events,
    ),
    collectAbsentWorktreesController: new CollectAbsentWorktreesController(
      new CollectAbsentWorktreesService(worktreePresenceStore, deps.clock),
      lanes,
      laneKeys,
    ),
  };
}
