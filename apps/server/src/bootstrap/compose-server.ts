import { randomUUID } from 'node:crypto';
import {
  IssuePairingService,
  ListAccessService,
  ReadEnvironmentService,
  RedeemPairingService,
  RevokeAccessService,
} from '@porcelain/access/services';
import type { PairingReach } from '@porcelain/access/ports';
import {
  AgentGenerationError,
  CliCommitGenerator,
} from '@porcelain/agents/commit-planning';
import { FileInspectionError } from '@porcelain/files/errors';
import {
  EditFileService,
  ListDirectoryService,
  ListWorktreePathsService,
  ReadAssetService,
  ReadPreviewAssetsService,
  ReadTextFileService,
} from '@porcelain/files/services';
import type {
  FileReader,
  FileWriter,
  IgnoredEntries,
} from '@porcelain/files/ports';
import { CommitDraftError } from '@porcelain/git-actions/errors';
import { gitActionReceiptView } from '@porcelain/git-actions/models';
import {
  AcceptGitActionService,
  AdmitCommitDraftService,
  CaptureCommitDraftService,
  DismissInterruptedGitActionService,
  ExecuteGitActionService,
  GenerateCommitDraftService,
  ListCommitModelsService,
  ListGitBranchesService,
  ReadGitActionReceiptService,
  ReadInterruptedGitActionService,
  RecordGitActionProgressService,
} from '@porcelain/git-actions/services';
import { ActionGit } from '@porcelain/git/actions';
import { checkIgnored } from '@porcelain/git/inspection';
import { listTrackedPaths } from '@porcelain/git/inspection';
import { CommitGit } from '@porcelain/git/history';
import type { DiscoveryIssue } from '@porcelain/git/discovery';
import { Git, isRepositoryUnavailable } from '@porcelain/git/discovery';
import { RequestGitSession } from '@porcelain/git/actions';
import { InspectionGit } from '@porcelain/git/inspection';
import type {
  ChangeComparison,
  ChangeSelection,
  ExpectedFile as ExpectedChangeFile,
  ReadChangesResult,
} from '@porcelain/changes/models';
import { conflictSchema } from '@porcelain/contracts/changes';
import {
  BrowseProjectFoldersService,
  CollectAbsentWorktreesService,
  DiscoverProjectsService,
  RegisterProjectService,
  RenameProjectService,
} from '@porcelain/projects/services';
import type { ProjectFolderReader as ProjectFolders } from '@porcelain/projects/ports';
import type { CommitReaderFactory } from '@porcelain/git/history';
import type { GitActionWriterFactory } from '@porcelain/git/actions';
import type { GitFactory } from '@porcelain/git/discovery';
import type { InspectionFactory } from '@porcelain/git/inspection';
import { readGitVersion } from '@porcelain/git/discovery';
import type {
  CommitGeneratorPort,
  CommitModelCatalogPort,
} from '@porcelain/git-actions/ports';
import type { ServerCapabilities } from './server-capabilities.ts';
import {
  createTrackedPathsReader,
  type TrackedPaths,
} from '../adapters/files/tracked-paths-reader.ts';
import { createReadableWorktrees } from '../adapters/files/readable-worktrees.ts';
import { composeChanges } from './compose-changes.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import { ActionExecutionAdapter } from '../adapters/git-actions/action-execution-adapter.ts';
import { CommitDraftCaptureAdapter } from '../adapters/git-actions/commit-draft-capture-adapter.ts';
import { GitBranchReaderAdapter } from '../adapters/git-actions/git-branch-reader-adapter.ts';
import { DismissInterruptedGitActionController } from '../controllers/dismiss-interrupted-git-action-controller.ts';
import { GenerateCommitDraftController } from '../controllers/generate-commit-draft-controller.ts';
import { ListCommitModelsController } from '../controllers/list-commit-models-controller.ts';
import { ListGitBranchesController } from '../controllers/list-git-branches-controller.ts';
import { ReadGitActionReceiptController } from '../controllers/read-git-action-receipt-controller.ts';
import { RunGitActionController } from '../controllers/run-git-action-controller.ts';
import { RenameProjectController } from '../controllers/rename-project-controller.ts';
import { CommentThreadsController } from '../controllers/comment-threads-controller.ts';
import { MarkCommentsSeenController } from '../controllers/mark-comments-seen-controller.ts';
import { ListReviewedFilesController } from '../controllers/list-reviewed-files-controller.ts';
import { RemoveReviewedFileController } from '../controllers/remove-reviewed-file-controller.ts';
import { SetReviewedFileController } from '../controllers/set-reviewed-file-controller.ts';
import { SetReviewedFilesController } from '../controllers/set-reviewed-files-controller.ts';
import { RedeemPairingController } from '../controllers/redeem-pairing-controller.ts';
import { IssuePairingController } from '../controllers/issue-pairing-controller.ts';
import { ListAccessController } from '../controllers/list-access-controller.ts';
import { RevokeAccessController } from '../controllers/revoke-access-controller.ts';
import { ReadHealthController } from '../controllers/read-health-controller.ts';
import { PublishReviewController } from '../controllers/publish-review-controller.ts';
import { ReadPublishedReviewController } from '../controllers/read-published-review-controller.ts';
import { ReadReviewSummaryController } from '../controllers/read-review-summary-controller.ts';
import { ListReviewedLayersController } from '../controllers/list-reviewed-layers-controller.ts';
import { SetReviewedLayerController } from '../controllers/set-reviewed-layer-controller.ts';
import { RemoveReviewedLayerController } from '../controllers/remove-reviewed-layer-controller.ts';
import { applicationSettingsSchema } from '../config/application-settings.ts';
import { NodeFileReader } from '../adapters/files/file-reader.ts';
import { NodeFileWriter } from '../adapters/files/file-writer.ts';
import { NodeProjectFolders } from '../adapters/files/project-folders.ts';
import { DeviceDirectory } from '../adapters/access/device-directory.ts';
import { LiveUpdates } from '../adapters/events/live-updates.ts';
import { Lanes } from '../runtime/lanes.ts';
import { LaunchLimit } from '../runtime/launch-limit.ts';
import { SharedReads } from '../runtime/shared-reads.ts';
import { WorktreeDirectory } from '../adapters/git/worktree-directory.ts';
import type { Project } from '@porcelain/contracts/projects';
import { CommentThreadsService } from '@porcelain/reviews/services';
import { ListFilePreferencesService } from '@porcelain/projects/services';
import {
  ListReviewedFilesService,
  RemoveReviewedFileService,
  SetReviewedFileService,
  SetReviewedFilesService,
} from '@porcelain/reviews/services';
import { RemoveProjectService } from '@porcelain/projects/services';
import { RemoveProjectController } from '../controllers/remove-project-controller.ts';
import { ListFilePreferencesController } from '../controllers/list-file-preferences-controller.ts';
import { SetFilePreferenceController } from '../controllers/set-file-preference-controller.ts';
import { ReadInventoryController } from '../controllers/read-inventory-controller.ts';
import { RegisterProjectController } from '../controllers/register-project-controller.ts';
import { DiscoverProjectsController } from '../controllers/discover-projects-controller.ts';
import { BrowseProjectFoldersController } from '../controllers/browse-project-folders-controller.ts';
import { ListDirectoryController } from '../controllers/list-directory-controller.ts';
import { ReadTextFileController } from '../controllers/read-text-file-controller.ts';
import { ReadFileAssetController } from '../controllers/read-file-asset-controller.ts';
import { ReadPreviewAssetsController } from '../controllers/read-preview-assets-controller.ts';
import { EditFileController } from '../controllers/edit-file-controller.ts';
import { ListWorktreePathsController } from '../controllers/list-worktree-paths-controller.ts';
import { resolveActionCheckout } from '../adapters/git-actions/action-checkout.ts';
import { ResolveWorktree } from '../adapters/projects/resolve-worktree.ts';
import { SetFilePreferenceService } from '@porcelain/projects/services';
import { openStorageSession } from '@porcelain/storage';
import {
  createDeviceStore,
  createEnvironmentIdentityStore,
  createPairingGrantStore,
} from '@porcelain/storage/access';
import { createWorktreeStatusStore } from '@porcelain/storage/changes';
import { createGitActionStore } from '@porcelain/storage/git-actions';
import {
  createFilePreferenceStore,
  createInventoryStore,
  createProjectRemovalStore,
  createWorktreePresenceStore,
} from '@porcelain/storage/projects';
import {
  createCommentStore,
  createReviewedFileStore,
  createReviewedLayerStore,
  createReviewStore,
} from '@porcelain/storage/reviews';
import {
  AssembleReviewDiagnosticsService,
  PublishReviewService,
  ReadPublishedReviewService,
  ReadReviewSummaryService,
  ResolvePublishedReviewService,
  ListReviewedLayersService,
  SetReviewedLayerService,
  RemoveReviewedLayerService,
  MarkCommentsSeenService,
} from '@porcelain/reviews/services';

const READ_CAPACITY = 4;
const LISTING_LAUNCHES = 4;
const LAST_SEEN_FLUSH_MS = 60_000;
const COLLECTION_INTERVAL_MS = 60 * 60_000;

export async function openApplication(options: {
  dataDirectory: string;
  git?: GitFactory;
  actionGit?: GitActionWriterFactory;
  commitGit?: CommitReaderFactory;
  inspectionGit?: InspectionFactory;
  files?: FileReader;
  ignoredEntries?: (root: string) => IgnoredEntries;
  trackedPaths?: TrackedPaths;
  projectFolders?: ProjectFolders;
  projectHome: string;
  pairingReach?: () => PairingReach;
  commitGenerator?: CommitGeneratorPort & CommitModelCatalogPort;
  fileWriter?: FileWriter;
  now?: () => string;
  signal?: AbortSignal;
  operationTimeoutMs?: number;
  projectListingTimeoutMs?: number;
}): Promise<ServerCapabilities> {
  const { operationTimeoutMs, projectListingTimeoutMs } =
    applicationSettingsSchema.parse(options);
  options.signal?.throwIfAborted();
  const session = openStorageSession(options.dataDirectory);
  let countProjects = () => 0;
  const listingBudgetMs = () =>
    Math.ceil(Math.max(countProjects(), 1) / LISTING_LAUNCHES) *
      projectListingTimeoutMs +
    operationTimeoutMs;
  const lanes = new Lanes({
    deadlineMs: listingBudgetMs,
    readCapacity: READ_CAPACITY,
    closeResources: () => session.close(),
  });
  const FILESYSTEM = 'filesystem';
  const INVENTORY = 'inventory';
  let firstRefreshFailure: unknown;
  const sharedReads = new SharedReads();
  try {
    const store = createInventoryStore(session);
    countProjects = () => store.read().projects.length;
    const git = options.git ?? ((checkout: string) => new Git(checkout));
    const launches = new LaunchLimit(LISTING_LAUNCHES);
    const directory = new WorktreeDirectory({
      git,
      reads: sharedReads,
      launches,
      timeoutMs: projectListingTimeoutMs,
      projects: () => store.read().projects,
    });
    const presence = createWorktreePresenceStore(session);
    const statuses = createWorktreeStatusStore(session);
    const collectAbsent = new CollectAbsentWorktreesService(
      presence,
      options.now ? () => Date.parse(options.now?.() ?? '') : undefined,
    );
    const worktrees = new ResolveWorktree(directory, store, presence);

    const listProjects = async (signal?: AbortSignal) => {
      const registered = store.read().projects;
      const listings = await Promise.all(
        registered.map((project) => directory.list(project, signal)),
      );
      const issues: DiscoveryIssue[] = [];
      const projects: Project[] = [];
      const present = new Set(
        store.read().projects.map((project) => project.id),
      );
      const dots = statuses.status(
        listings.flatMap((listing) =>
          listing.worktrees.map((worktree) => worktree.id),
        ),
      );
      for (const [index, project] of registered.entries()) {
        const listing = listings[index];
        if (!listing || !present.has(project.id)) continue;
        const available = listing.failure === undefined;
        if (available !== project.available)
          store.save({ ...project, available });
        issues.push(...listing.issues);
        if (available && listing.complete) {
          presence.observe(
            project.id,
            listing.worktrees.map((worktree) => worktree.id),
            options.now?.() ?? new Date().toISOString(),
          );
        } else if (listing.failure) {
          issues.push({
            path: project.commonDirectory,
            error: listing.failure,
          });
        }
        projects.push({
          ...project,
          available,
          worktrees: listing.worktrees.map((worktree) => ({
            ...worktree,
            status: dots.get(worktree.id) ?? null,
          })),
        });
      }
      return {
        inventory: { environmentId: store.read().environmentId, projects },
        issues,
      };
    };
    const stored = async <T>(read: () => T | Promise<T>): Promise<T> => {
      lanes.assertOpen();
      return read();
    };

    const forWorktree = <T>(
      read: (signal: AbortSignal) => T | Promise<T>,
      signal?: AbortSignal,
    ): Promise<T> =>
      lanes.unqueued(async (operationSignal) => read(operationSignal), {
        callerSignal: signal,
      });

    const laneOf = (worktreeId: string) =>
      directory.repositoryOf(worktreeId) ?? 'unresolved';
    const projectLaneOf = (projectId: string) =>
      store.read().projects.find((entry) => entry.id === projectId)
        ?.repositoryIdentity ?? 'unresolved';
    const markSeen = new MarkCommentsSeenService(statuses);
    const removeProject = new RemoveProjectService(
      createProjectRemovalStore(session),
    );
    const actionStore = createGitActionStore(session);
    actionStore.recover();
    const actionGit =
      options.actionGit ?? ((checkout) => new ActionGit(checkout));

    const preferences = createFilePreferenceStore(session);
    const listPreferences = new ListFilePreferencesService(store, preferences);
    const setPreference = new SetFilePreferenceService(store, preferences);
    const pairingGrants = createPairingGrantStore(session);
    const deviceStore = createDeviceStore(session);
    const deviceDirectory = new DeviceDirectory(deviceStore);
    const issuePairing = new IssuePairingService(
      pairingGrants,
      createEnvironmentIdentityStore(session),
      {
        current:
          options.pairingReach ??
          (() => ({
            port: 0,
            policy: { allowedHosts: [], localAddresses: [] },
          })),
      },
    );
    const listAccess = new ListAccessService(pairingGrants, deviceStore);
    const redeemPairing = new RedeemPairingService(
      pairingGrants,
      deviceDirectory,
    );
    const redeemPairingController = new RedeemPairingController(
      redeemPairing,
      stored,
    );
    const issuePairingController = new IssuePairingController(
      issuePairing,
      stored,
    );
    const listAccessController = new ListAccessController(listAccess, stored);
    const readHealthController = new ReadHealthController(
      new ReadEnvironmentService(createEnvironmentIdentityStore(session)),
    );
    const revokeAccess = new RevokeAccessService(
      pairingGrants,
      deviceDirectory,
    );
    const revokeAccessController = new RevokeAccessController(
      revokeAccess,
      stored,
    );
    const lastSeenFlush = setInterval(
      () => deviceDirectory.flush(),
      LAST_SEEN_FLUSH_MS,
    );
    lastSeenFlush.unref();
    const collection = setInterval(() => {
      try {
        collectAbsent.execute();
      } catch {}
    }, COLLECTION_INTERVAL_MS);
    collection.unref();
    const folders = options.projectFolders ?? new NodeProjectFolders();
    const projectRepositories = {
      inspect: (checkout: string, signal?: AbortSignal) =>
        git(checkout).listWorktrees(signal),
      readOriginUrl: async (checkout: string, signal?: AbortSignal) =>
        (await git(checkout).readOriginUrl(signal)) ?? undefined,
      isUnavailable: isRepositoryUnavailable,
    };
    const browseProjects = new BrowseProjectFoldersService(
      folders,
      projectRepositories,
      options.projectHome,
    );
    const discoverProjects = new DiscoverProjectsService(
      folders,
      projectRepositories,
      store,
      options.projectHome,
      (error) =>
        error instanceof FileInspectionError &&
        ['PATH_NOT_FOUND', 'PATH_NOT_READABLE', 'UNSUPPORTED_PATH'].includes(
          error.code,
        ),
    );
    void readGitVersion().catch(() => undefined);
    const commitGit =
      options.commitGit ?? ((checkout) => new CommitGit(checkout));
    const files = options.files ?? new NodeFileReader();
    const readableWorktrees = createReadableWorktrees(worktrees);
    const list = new ListDirectoryService(
      readableWorktrees,
      files,
      options.ignoredEntries ??
        ((root) => (paths, signal) => checkIgnored(root, paths, signal)),
    );
    const read = new ReadTextFileService(readableWorktrees, files);
    const asset = new ReadAssetService(readableWorktrees, new NodeFileReader());
    const previewAssets = new ReadPreviewAssetsService(
      readableWorktrees,
      new NodeFileReader(),
    );
    const worktreePaths = new ListWorktreePathsService(
      readableWorktrees,
      createTrackedPathsReader(options.trackedPaths ?? listTrackedPaths),
    );
    const editFile = new EditFileService(
      readableWorktrees,
      options.fileWriter ?? new NodeFileWriter(),
    );
    const register = new RegisterProjectService(
      store,
      projectRepositories,
      directory,
    );
    const inspection =
      options.inspectionGit ?? ((checkout) => new InspectionGit(checkout));
    const reviewStore = createReviewStore(session);
    const reviewDiagnostics = new AssembleReviewDiagnosticsService();
    const resolvePublishedReview = new ResolvePublishedReviewService(
      reviewStore,
    );
    const reviewEvidence = {
      readChanges: (worktreeId: string, signal?: AbortSignal) =>
        changes.read(worktreeId, signal),
      readDiffs: (
        worktreeId: string,
        statusToken: string,
        expectedFiles: readonly ExpectedChangeFile[],
        selections: readonly ChangeSelection[],
        signal?: AbortSignal,
      ) =>
        changeDiffs.execute(
          worktreeId,
          statusToken,
          expectedFiles,
          selections,
          signal,
        ),
    };
    const readPublishedReviewController = new ReadPublishedReviewController(
      worktrees,
      new ReadPublishedReviewService(reviewStore),
      read,
      reviewEvidence,
      reviewDiagnostics,
      resolvePublishedReview,
      () => store.read().environmentId,
      (operation, signal) => forWorktree(operation, signal),
    );
    const publishReviewController = new PublishReviewController(
      worktrees,
      new PublishReviewService(reviewStore, options.now),
      read,
      reviewEvidence,
      reviewDiagnostics,
      resolvePublishedReview,
      () => store.read().environmentId,
      (operation, signal) => forWorktree(operation, signal),
      (worktreeId) => live.publishWorktree(worktreeId, 'review'),
    );
    const readReviewSummaryController = new ReadReviewSummaryController(
      new ReadReviewSummaryService(reviewStore),
      () => lanes.assertOpen(),
    );
    const reviewedLayers = createReviewedLayerStore(session);
    const reviewed = createReviewedFileStore(session);
    const live = new LiveUpdates({
      worktrees,
      reviewed,
      reviewedLayers,
      projects: () => store.read().projects,
    });
    const listReviewedLayersController = new ListReviewedLayersController(
      worktrees,
      new ListReviewedLayersService(reviewedLayers),
      (operation, signal) => forWorktree(operation, signal),
    );
    const setReviewedLayerController = new SetReviewedLayerController(
      worktrees,
      new SetReviewedLayerService(reviewedLayers, options.now),
      (operation, signal) => forWorktree(operation, signal),
      (worktreeId) => live.publishWorktree(worktreeId, 'reviewed'),
    );
    const removeReviewedLayerController = new RemoveReviewedLayerController(
      worktrees,
      new RemoveReviewedLayerService(reviewedLayers),
      (operation, signal) => forWorktree(operation, signal),
      (worktreeId) => live.publishWorktree(worktreeId, 'reviewed'),
    );
    const renameProjectController = new RenameProjectController(
      new RenameProjectService(store),
      (operation, signal) =>
        lanes.run(INVENTORY, 'write', async () => operation(), {
          callerSignal: signal,
        }),
      () => live.publish({ type: 'inventory' }),
    );
    const removeProjectController = new RemoveProjectController(
      removeProject,
      (projectId, operation, signal) =>
        lanes.run(projectLaneOf(projectId), 'write', async () => operation(), {
          callerSignal: signal,
        }),
      (projectId) => directory.forget(projectId),
      () => live.publish({ type: 'inventory' }),
    );
    const listFilePreferencesController = new ListFilePreferencesController(
      listPreferences,
      stored,
    );
    const setFilePreferenceController = new SetFilePreferenceController(
      setPreference,
      stored,
      (projectId) =>
        live.publish({ type: 'project', projectId, change: 'preferences' }),
    );
    const readInventoryController = new ReadInventoryController(
      async (signal) =>
        (
          await lanes.run(
            INVENTORY,
            'read',
            ({ signal: operationSignal }) => listProjects(operationSignal),
            { callerSignal: signal },
          )
        ).inventory,
    );
    const discoverProjectsController = new DiscoverProjectsController(
      (signal) =>
        lanes.run(
          FILESYSTEM,
          'read',
          ({ signal: operationSignal }) =>
            discoverProjects.execute(operationSignal),
          { callerSignal: signal },
        ),
    );
    const browseProjectFoldersController = new BrowseProjectFoldersController(
      (path, signal) =>
        lanes.run(
          FILESYSTEM,
          'read',
          ({ signal: operationSignal }) =>
            browseProjects.execute(path, operationSignal),
          { callerSignal: signal },
        ),
    );
    const registerProjectController = new RegisterProjectController(
      register,
      (ids) => statuses.status(ids),
      (operation, signal) =>
        lanes.run(
          INVENTORY,
          'write',
          ({ signal: operationSignal }) => operation(operationSignal),
          { callerSignal: signal },
        ),
      () => live.publish({ type: 'inventory' }),
    );
    const runWorktreeRead = <T>(
      worktreeId: string,
      operation: (signal: AbortSignal) => Promise<T>,
      signal?: AbortSignal,
    ) =>
      lanes.run(
        laneOf(worktreeId),
        'read',
        ({ signal: operationSignal }) => operation(operationSignal),
        { callerSignal: signal },
      );
    const runWorktreeWrite = <T>(
      worktreeId: string,
      operation: (signal: AbortSignal) => Promise<T>,
      signal?: AbortSignal,
    ) =>
      lanes.run(
        laneOf(worktreeId),
        'write',
        ({ signal: operationSignal }) => operation(operationSignal),
        { callerSignal: signal },
      );
    const listDirectoryController = new ListDirectoryController(
      list,
      runWorktreeRead,
    );
    const readTextFileController = new ReadTextFileController(
      read,
      runWorktreeRead,
    );
    const readFileAssetController = new ReadFileAssetController(
      asset,
      runWorktreeRead,
    );
    const readPreviewAssetsController = new ReadPreviewAssetsController(
      previewAssets,
      runWorktreeRead,
    );
    const editFileController = new EditFileController(
      editFile,
      runWorktreeWrite,
      (worktreeId, paths) => live.noteFiles(worktreeId, paths),
    );
    const listWorktreePathsController = new ListWorktreePathsController(
      worktreePaths,
      runWorktreeRead,
    );
    const acceptAction = new AcceptGitActionService(actionStore);
    const readActionReceipt = new ReadGitActionReceiptService(actionStore);
    const readInterruptedAction = new ReadInterruptedGitActionService(
      actionStore,
    );
    const laneKeys: LaneKeys = {
      inventory: () => INVENTORY,
      filesystem: () => FILESYSTEM,
      project: projectLaneOf,
      worktree: laneOf,
    };
    const changesDomain = composeChanges({
      session,
      lanes,
      laneKeys,
      sharedReads,
      worktreeAccess: worktrees,
      reachableWorktrees: worktrees,
      inventory: store,
      inspection,
      commitGit,
      files,
      reviewedFileStore: reviewed,
      readInterruptedGitAction: readInterruptedAction,
    });
    const changeServices = changesDomain.services;
    const legacyComparison = (comparison: ChangeComparison) => {
      if (comparison.scope === 'untracked') return comparison;
      if (comparison.scope === 'unmerged')
        return {
          ...comparison,
          conflict: conflictSchema.encode(comparison.conflict),
        };
      return {
        ...comparison,
        oldPath: comparison.oldPath ?? null,
        newPath: comparison.newPath ?? null,
        oldOid: comparison.oldOid ?? null,
        newOid: comparison.newOid ?? null,
      };
    };
    const changes = {
      read: async (
        worktreeId: string,
        signal?: AbortSignal,
      ): Promise<ReadChangesResult> => {
        await changeServices.confirmWorktree.execute({ worktreeId }, signal);
        const status = await changeServices.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        const observed = await changeServices.readChangeFingerprints.execute(
          { worktreeId, comparisons: status.changes, paths: undefined },
          signal,
        );
        await changeServices.confirmWorktree.execute({ worktreeId }, signal);
        return {
          environmentId: changeServices.readEnvironment.execute(),
          worktreeId,
          statusToken: status.statusToken,
          headOid: status.headOid,
          inProgress: status.inProgress,
          mergeHeadOid: status.mergeHeadOid,
          branch: status.branch,
          changes: observed.changes,
        };
      },
      execute: async (
        worktreeId: string,
        _session: unknown,
        signal?: AbortSignal,
      ) => {
        const list = await changes.read(worktreeId, signal);
        return {
          statusToken: list.statusToken,
          headOid: list.headOid ?? null,
          changes: list.changes.map((change) => ({
            path: change.path,
            fingerprint: change.fingerprint ?? null,
            comparisons: change.comparisons.map(legacyComparison),
          })),
        };
      },
      fingerprints: async (
        worktreeId: string,
        paths: readonly string[],
        _session: unknown,
        signal?: AbortSignal,
      ) => {
        const status = await changeServices.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        const observed = await changeServices.readChangeFingerprints.execute(
          { worktreeId, comparisons: status.changes, paths },
          signal,
        );
        await changeServices.confirmWorktree.execute({ worktreeId }, signal);
        return new Map(
          observed.changes.flatMap(({ path, fingerprint }) =>
            fingerprint === undefined ? [] : [[path, fingerprint] as const],
          ),
        );
      },
    };
    const changeDiffs = {
      execute: async (
        worktreeId: string,
        expectedStatusToken: string,
        expectedFiles: readonly ExpectedChangeFile[],
        selections: readonly ChangeSelection[],
        signal?: AbortSignal,
      ) => {
        await changeServices.confirmWorktree.execute({ worktreeId }, signal);
        const before = await changeServices.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        const selected = changeServices.selectDiffComparisons.execute({
          expectedFiles,
          selections,
          status: before,
        });
        const observed = await changeServices.readChangeFingerprints.execute(
          { worktreeId, comparisons: before.changes, paths: selected.paths },
          signal,
        );
        changeServices.confirmDiffObservation.execute({
          expectedStatusToken,
          expectedFiles,
          statusToken: before.statusToken,
          fingerprints: observed,
          previousStamp: undefined,
        });
        const diffs = await changeServices.readChangeDiffs.execute(
          { worktreeId, comparisons: selected.comparisons },
          signal,
        );
        const after = await changeServices.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        changeServices.confirmDiffObservation.execute({
          expectedStatusToken,
          expectedFiles,
          statusToken: after.statusToken,
          fingerprints: await changeServices.readChangeFingerprints.execute(
            { worktreeId, comparisons: after.changes, paths: selected.paths },
            signal,
          ),
          previousStamp: observed.stamp,
        });
        await changeServices.confirmWorktree.execute({ worktreeId }, signal);
        return {
          environmentId: changeServices.readEnvironment.execute(),
          worktreeId,
          statusToken: before.statusToken,
          diffs,
        };
      },
    };
    const dismissInterruptedAction = new DismissInterruptedGitActionService(
      actionStore,
    );
    const recordActionProgress = new RecordGitActionProgressService(
      actionStore,
    );
    const executeAction = new ExecuteGitActionService(
      new ActionExecutionAdapter(
        async (scope, session, signal) =>
          (
            await resolveActionCheckout(
              worktrees,
              store,
              session,
              scope,
              signal,
            )
          ).checkout,
        actionGit,
        async (worktreeId, session, signal) =>
          new Map(
            (await changes.execute(worktreeId, session, signal)).changes.map(
              (entry) => [entry.path, entry.fingerprint],
            ),
          ),
        (worktreeId, paths, session, signal) =>
          changes.fingerprints(worktreeId, paths, session, signal),
      ),
      actionStore,
      async (worktreeId, signal) => {
        await readPublishedReviewController.execute({ worktreeId }, { signal });
      },
    );
    const runGitActionController = new RunGitActionController(
      lanes,
      projectLaneOf,
      acceptAction,
      executeAction,
      readActionReceipt,
      recordActionProgress,
      (receipt) =>
        live.publish({
          type: 'git-action',
          projectId: receipt.projectId,
          worktreeId: receipt.worktreeId,
          receipt: gitActionReceiptView(receipt),
        }),
    );
    const readGitActionReceiptController = new ReadGitActionReceiptController(
      lanes,
      readActionReceipt,
    );
    const dismissInterruptedGitActionController =
      new DismissInterruptedGitActionController(
        lanes,
        dismissInterruptedAction,
      );
    const listGitBranchesController = new ListGitBranchesController(
      lanes,
      projectLaneOf,
      new ListGitBranchesService(
        new GitBranchReaderAdapter(
          async (scope, session, signal) =>
            (
              await resolveActionCheckout(
                worktrees,
                store,
                session,
                scope,
                signal,
              )
            ).checkout,
          actionGit,
        ),
      ),
    );
    const provider = new CliCommitGenerator();
    const generator: CommitGeneratorPort & CommitModelCatalogPort =
      options.commitGenerator ?? {
        models: (signal) => provider.models(signal),
        generate: async (model, prompt, signal) => {
          try {
            return await provider.generate(model, prompt, signal);
          } catch (error) {
            signal.throwIfAborted();
            if (error instanceof AgentGenerationError)
              throw new CommitDraftError(error.message, { cause: error });
            throw error;
          }
        },
      };
    const generateCommitDraft = new GenerateCommitDraftService(generator);
    const listCommitModelsController = new ListCommitModelsController(
      lanes,
      new ListCommitModelsService(generator),
    );
    const captureCommitDraft = new CaptureCommitDraftService(
      new CommitDraftCaptureAdapter(
        (worktreeId, session, signal) =>
          changes.execute(worktreeId, session, signal),
        async (scope, session, signal) => {
          const { checkout, worktree } = await resolveActionCheckout(
            worktrees,
            store,
            session,
            scope,
            signal,
          );
          return { checkout, root: worktree.path };
        },
        actionGit,
        files,
      ),
    );
    const generateCommitDraftController = new GenerateCommitDraftController(
      lanes,
      projectLaneOf,
      new AdmitCommitDraftService(),
      captureCommitDraft,
      generateCommitDraft,
    );
    const listReviewedFiles = new ListReviewedFilesService(reviewed);
    const setReviewedFile = new SetReviewedFileService(reviewed, options.now);
    const setReviewedFiles = new SetReviewedFilesService(reviewed, options.now);
    const removeReviewedFile = new RemoveReviewedFileService(reviewed);
    const listReviewedFilesController = new ListReviewedFilesController(
      worktrees,
      listReviewedFiles,
      forWorktree,
    );
    const removeReviewedFileController = new RemoveReviewedFileController(
      worktrees,
      removeReviewedFile,
      forWorktree,
      (worktreeId) => live.publishWorktree(worktreeId, 'reviewed'),
    );
    const reviewedSession = () => new RequestGitSession();
    const observeReviewedChanges = (
      worktreeId: string,
      session: RequestGitSession,
      signal: AbortSignal,
    ) => changes.execute(worktreeId, session, signal);
    const confirmReviewedSession = (
      _session: RequestGitSession,
      signal: AbortSignal,
    ) => changesDomain.sessions.for(signal).confirmAll(signal);
    const setReviewedFileController = new SetReviewedFileController(
      worktrees,
      setReviewedFile,
      reviewedSession,
      observeReviewedChanges,
      confirmReviewedSession,
      runWorktreeRead,
      (worktreeId) => live.publishWorktree(worktreeId, 'reviewed'),
    );
    const setReviewedFilesController = new SetReviewedFilesController(
      worktrees,
      setReviewedFiles,
      reviewedSession,
      observeReviewedChanges,
      confirmReviewedSession,
      runWorktreeRead,
      (worktreeId) => live.publishWorktree(worktreeId, 'reviewed'),
    );
    store.markAllUnavailable();
    const firstRefresh = lanes
      .run(INVENTORY, 'write', ({ signal }) => listProjects(signal), {
        callerSignal: options.signal,
      })
      .then(
        () => undefined,
        (cause: unknown) => {
          firstRefreshFailure = cause;
        },
      );
    const comments = new CommentThreadsService(
      createCommentStore(session),
      worktrees,
      randomUUID,
      options.now,
    );
    const commentThreadsController = new CommentThreadsController(
      comments,
      forWorktree,
      (worktreeId) => live.publishWorktree(worktreeId, 'comments'),
    );
    const markCommentsSeenController = new MarkCommentsSeenController(
      worktrees,
      markSeen,
      forWorktree,
      (worktreeId) => live.publishWorktree(worktreeId, 'comments'),
    );
    return {
      listCommitsController: changesDomain.listCommitsController,
      readCommitFilesController: changesDomain.readCommitFilesController,
      readCommitDiffsController: changesDomain.readCommitDiffsController,
      readChangesController: changesDomain.readChangesController,
      readChangeDiffsController: changesDomain.readChangeDiffsController,
      readChangeLinesController: changesDomain.readChangeLinesController,
      readGitStatusController: changesDomain.readGitStatusController,
      readPublishedReviewController,
      publishReviewController,
      readReviewSummaryController,
      listReviewedLayersController,
      setReviewedLayerController,
      removeReviewedLayerController,
      commentThreadsController,
      markCommentsSeenController,
      listReviewedFilesController,
      removeReviewedFileController,
      setReviewedFileController,
      setReviewedFilesController,
      redeemPairingController,
      issuePairingController,
      listAccessController,
      revokeAccessController,
      readHealthController,
      projects: renameProjectController,
      removeProjectController,
      listFilePreferencesController,
      setFilePreferenceController,
      readInventoryController,
      discoverProjectsController,
      browseProjectFoldersController,
      registerProjectController,
      listDirectoryController,
      readTextFileController,
      readFileAssetController,
      readPreviewAssetsController,
      editFileController,
      listWorktreePathsController,
      runGitActionController,
      readGitActionReceiptController,
      dismissInterruptedGitActionController,
      listGitBranchesController,
      listCommitModelsController,
      generateCommitDraftController,
      liveUpdates: (send) => live.connect(send),
      ready: async () => {
        await firstRefresh;
        if (firstRefreshFailure !== undefined) {
          if (firstRefreshFailure instanceof Error) throw firstRefreshFailure;
          throw new Error('Startup refresh failed', {
            cause: firstRefreshFailure,
          });
        }
      },
      authenticateDevice: (credential, address) =>
        deviceDirectory.authenticate(credential, address),
      holdForDevice: (deviceId, connection) =>
        deviceDirectory.register(deviceId, connection),
      issuePairing: (labels, addresses) =>
        issuePairingController
          .execute({ labels: [...labels], addresses: [...addresses] })
          .then(({ grants }) => grants),
      close: async () => {
        clearInterval(lastSeenFlush);
        clearInterval(collection);
        try {
          deviceDirectory.flush();
        } catch {}
        await live.close();
        await lanes.close();
      },
    };
  } catch (error) {
    await lanes.close();
    throw error;
  }
}
