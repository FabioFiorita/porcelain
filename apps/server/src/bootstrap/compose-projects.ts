import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import {
  ReadEnvironmentService,
  ReadEnvironmentNameService,
} from '@porcelain/access/services';
import { ReadInventoryBadgesUseCasePort } from '../ports/read-inventory-badges-use-case-port.ts';
import { ReadTextFilesService } from '@porcelain/files/services';
import {
  ListReviewedLayerPathsService,
  ReadReviewBadgesService,
} from '@porcelain/reviews/services';
import { InventoryRefresh } from '../ports/inventory-refresh.ts';
import { EventPublisher } from '../ports/event-publisher.ts';
import { LaneKeys } from '../runtime/lane-keys.ts';
import { Lanes } from '../runtime/lanes.ts';
import { WorktreeConsistencyProbe } from '../ports/worktree-consistency-probe.ts';
import { CheckWorktreeUseCasePort } from '../ports/check-worktree-use-case-port.ts';
import { Clock, IdSource } from '@porcelain/kernel/ports';
import { Context, Effect, Layer } from 'effect';
import { projectsRoutes } from '../http/routes/projects/projects-api.ts';
import {
  ProjectFolderReader,
  WorktreeListingReader,
  WorktreeCatalogStore,
  InventoryStore,
  WorktreePresenceStore,
  ProjectRepositoryReader,
  FilePreferenceStore,
  BrowseProjectFoldersOptions,
  SetFilePreferenceOptions,
  CollectAbsentWorktreesOptions,
} from '@porcelain/projects/ports';
import {
  FindWorktreeAtPathService,
  BrowseProjectFoldersService,
  CheckProjectService,
  CollectAbsentWorktreesService,
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
  ListRegisteredProjectsService,
  ListKnownWorktreesService,
  CheckWorktreeService,
  CheckRefreshedWorktreeService,
} from '@porcelain/projects/services';
import { GitProjectRepositoryReader } from '../adapters/projects/git-project-repository-reader.ts';
import { CoalescedWork } from '../runtime/coalesced-work.ts';
import { WorktreeAccess } from '../runtime/worktree-access.ts';
import { ReadInventoryBadgesUseCase } from '../use-cases/projects/read-inventory-badges.ts';
import { BrowseProjectFoldersUseCase } from '../use-cases/projects/browse-project-folders.ts';
import { CheckWorktreeUseCase } from '../use-cases/projects/check-worktree.ts';
import { CollectAbsentWorktreesUseCase } from '../use-cases/projects/collect-absent-worktrees.ts';
import { FindWorktreeByPathUseCase } from '../use-cases/projects/find-worktree-by-path.ts';
import { ListFilePreferencesUseCase } from '../use-cases/projects/list-file-preferences.ts';
import { ReadInventoryUseCase } from '../use-cases/projects/read-inventory.ts';
import { RefreshInventoryUseCase } from '../use-cases/projects/refresh-inventory.ts';
import { RegisterProjectUseCase } from '../use-cases/projects/register-project.ts';
import { RemoveProjectUseCase } from '../use-cases/projects/remove-project.ts';
import { RenameProjectUseCase } from '../use-cases/projects/rename-project.ts';
import { SetFilePreferenceUseCase } from '../use-cases/projects/set-file-preference.ts';
import { type ComposeContext } from './compose-context.ts';
import { type Shared } from './compose-shared.ts';
import { type Stores } from './compose-stores.ts';

type ProjectsDependencies = {
  stores: Stores;
  shared: Shared;
  projectFolderReader: ProjectFolderReader;
};

class InventoryCoordinator extends Context.Service<
  InventoryCoordinator,
  CoalescedWork<ProjectNotFoundError>
>()('@porcelain/server/InventoryCoordinator') {
  static readonly layer = Layer.effect(
    InventoryCoordinator,
    Effect.map(
      RefreshInventoryUseCase,
      (refresh) => new CoalescedWork(refresh),
    ),
  );
}

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
  const ports = Layer.mergeAll(
    Layer.succeed(WorktreeListingReader, shared.worktreeListing),
    Layer.succeed(WorktreeCatalogStore, catalog),
    Layer.succeed(InventoryStore, inventory),
    Layer.succeed(WorktreePresenceStore, worktreePresence),
    Layer.succeed(Clock, clock),
    Layer.succeed(ListRegisteredProjectsService, listRegisteredProjects),
    Layer.succeed(ListKnownWorktreesService, listKnownWorktrees),
    Layer.succeed(Lanes, lanes),
    Layer.succeed(LaneKeys, laneKeys),
    Layer.succeed(EventPublisher, events),
    Layer.succeed(CheckWorktreeService, shared.checkWorktreeService),
    Layer.succeed(CheckRefreshedWorktreeService, shared.checkRefreshedWorktree),
    Layer.succeed(WorktreeConsistencyProbe, shared.confirmWorktree),
    Layer.succeed(ListReviewedLayerPathsService, shared.listReviewedLayerPaths),
    Layer.succeed(ReadTextFilesService, shared.readTextFilesService),
    Layer.succeed(ReadReviewBadgesService, readWorktreeStatuses),
    Layer.succeed(ReadEnvironmentService, shared.readEnvironment),
    Layer.succeed(ReadEnvironmentNameService, shared.readEnvironmentName),
    Layer.succeed(ProjectRepositoryReader, projectRepositoryReader),
    Layer.succeed(IdSource, ids),
    Layer.succeed(FilePreferenceStore, filePreference),
    Layer.succeed(ProjectFolderReader, projectFolderReader),
    Layer.succeed(BrowseProjectFoldersOptions, {
      home: settings.projectHome,
      ...limits.folders,
    }),
    Layer.succeed(SetFilePreferenceOptions, limits.filePreferences),
    Layer.succeed(CollectAbsentWorktreesOptions, limits.presence),
  );
  const services = Layer.mergeAll(
    ListProjectWorktreesService.layer,
    UpdateProjectAvailabilityService.layer,
    CheckProjectService.layer,
    RecordWorktreePresenceService.layer,
    MarkProjectsUnavailableService.layer,
    RecordWorktreeCatalogService.layer,
    FindWorktreeAtPathService.layer,
    InspectProjectRepositoryService.layer,
    ReadRepositoryOriginService.layer,
    RegisterProjectService.layer,
    RenameProjectService.layer,
    FindProjectService.layer,
    ForgetProjectRecordsService.layer,
    RemoveProjectService.layer,
    BrowseProjectFoldersService.layer,
    ListFilePreferencesService.layer,
    SetFilePreferenceService.layer,
    ListExpiredWorktreesService.layer,
    CollectAbsentWorktreesService.layer,
  ).pipe(Layer.provideMerge(ports));
  const operations = Layer.mergeAll(
    RefreshInventoryUseCase.layer,
    RenameProjectUseCase.layer,
    BrowseProjectFoldersUseCase.layer,
    ListFilePreferencesUseCase.layer,
    SetFilePreferenceUseCase.layer,
    CollectAbsentWorktreesUseCase.layer,
  ).pipe(Layer.provideMerge(services));
  const admission = Layer.mergeAll(InventoryCoordinator.layer).pipe(
    Layer.provideMerge(operations),
  );
  const application = Layer.mergeAll(
    Layer.effect(InventoryRefresh, InventoryCoordinator),
  ).pipe(Layer.provideMerge(admission));
  const layer4 = Layer.mergeAll(
    CheckWorktreeUseCase.layer,
    FindWorktreeByPathUseCase.layer,
    RemoveProjectUseCase.layer,
  ).pipe(Layer.provideMerge(application));
  const layer5 = Layer.mergeAll(
    Layer.effect(CheckWorktreeUseCasePort, CheckWorktreeUseCase),
  ).pipe(Layer.provideMerge(layer4));
  const layer6 = Layer.mergeAll(WorktreeAccess.layer).pipe(
    Layer.provideMerge(layer5),
  );
  const layer7 = Layer.mergeAll(ReadInventoryBadgesUseCase.layer).pipe(
    Layer.provideMerge(layer6),
  );
  const layer8 = Layer.mergeAll(
    Layer.effect(ReadInventoryBadgesUseCasePort, ReadInventoryBadgesUseCase),
  ).pipe(Layer.provideMerge(layer7));
  const layer9 = Layer.mergeAll(
    ReadInventoryUseCase.layer,
    RegisterProjectUseCase.layer,
  ).pipe(Layer.provideMerge(layer8));
  return Effect.gen(function* () {
    const useCases = {
      readInventory: yield* ReadInventoryUseCase,
      findWorktreeByPath: yield* FindWorktreeByPathUseCase,
      refreshInventory: yield* InventoryCoordinator,
      checkWorktree: yield* CheckWorktreeUseCase,
      registerProject: yield* RegisterProjectUseCase,
      renameProject: yield* RenameProjectUseCase,
      removeProject: yield* RemoveProjectUseCase,
      browseProjectFolders: yield* BrowseProjectFoldersUseCase,
      listFilePreferences: yield* ListFilePreferencesUseCase,
      setFilePreference: yield* SetFilePreferenceUseCase,
      collectAbsentWorktrees: yield* CollectAbsentWorktreesUseCase,
    };
    return { ...useCases, routes: projectsRoutes(useCases) };
  }).pipe(Effect.provide(layer9));
}
