import { randomBytes, randomUUID } from 'node:crypto';
import {
  associateCommitReviewLayersSchema,
  commitReviewLayerParamsSchema,
} from '@porcelain/contracts/commit-review-layers';
import {
  replaceReviewLayersSchema,
  reviewLayerParamsSchema,
} from '@porcelain/contracts/review-layers';
import { ActionGit } from '@porcelain/git/action-git';
import { CommitCursorCodec } from '@porcelain/git/commit-cursor';
import { CommitGit } from '@porcelain/git/commit-git';
import { Git } from '@porcelain/git/git';
import { RequestGitSession } from '@porcelain/git/git-session';
import { InspectionGit } from '@porcelain/git/inspection-git';
import type { CommitReaderFactory } from '@porcelain/git/interfaces/commit-reader';
import type { GitActionWriterFactory } from '@porcelain/git/interfaces/git-action-writer';
import type { GitFactory } from '@porcelain/git/interfaces/git-factory';
import type { InspectionFactory } from '@porcelain/git/interfaces/inspection-factory';
import { readGitVersion } from '@porcelain/git/read-git-version';
import { readTreePaths } from '@porcelain/git/tree-paths';
import { CliCommitGenerator } from './agents/cli-commit-generator.ts';
import type { CommitGenerator } from './agents/interfaces/commit-generator.ts';
import type { Application } from './application.ts';
import { applicationSettingsSchema } from './config/application-settings.ts';
import { openDatabase } from './db/connection.ts';
import { NodeFileReader } from './filesystem/file-reader.ts';
import { readFileStamps } from './filesystem/file-stamps.ts';
import { NodeFileTree } from './filesystem/file-tree.ts';
import { NodeFileWriter } from './filesystem/file-writer.ts';
import type { FileReader } from './filesystem/interfaces/file-reader.ts';
import type { FileWriter } from './filesystem/interfaces/file-writer.ts';
import type { ProjectFolders } from './filesystem/interfaces/project-folders.ts';
import { NodeProjectFolders } from './filesystem/project-folders.ts';
import { DeviceDirectory } from './lifecycle/device-directory.ts';
import { GitActionCoordinator } from './lifecycle/git-action-coordinator.ts';
import { Lanes } from './lifecycle/lanes.ts';
import { SharedReads } from './lifecycle/shared-reads.ts';
import { ArtifactRepository } from './repositories/artifact-repository.ts';
import { CommentRepository } from './repositories/comment-repository.ts';
import { CommitReviewLayerRepository } from './repositories/commit-review-layer-repository.ts';
import { FilePreferenceRepository } from './repositories/file-preference-repository.ts';
import { GitActionRepository } from './repositories/git-action-repository.ts';
import { InventoryRepository } from './repositories/inventory-repository.ts';
import { PairingRepository } from './repositories/pairing-repository.ts';
import { ProjectRemovalRepository } from './repositories/project-removal-repository.ts';
import { ReviewLayerRepository } from './repositories/review-layer-repository.ts';
import { ReviewedFileRepository } from './repositories/reviewed-file-repository.ts';
import { AcceptGitAction } from './use-cases/accept-git-action.ts';
import { AssociateCommitReviewLayers } from './use-cases/associate-commit-review-layers.ts';
import { CommentThreads } from './use-cases/comment-threads.ts';
import { CommitDrafts } from './use-cases/commit-drafts.ts';
import { CompleteCommitReview } from './use-cases/complete-commit-review.ts';
import { DeleteArtifact } from './use-cases/delete-artifact.ts';
import { EditFile } from './use-cases/edit-file.ts';
import { ExecuteGitAction } from './use-cases/execute-git-action.ts';
import { FindProjects } from './use-cases/find-projects.ts';
import { GetArtifact } from './use-cases/get-artifact.ts';
import { GetCommitReviewLayers } from './use-cases/get-commit-review-layers.ts';
import { InspectCommitChanges } from './use-cases/inspect-commit-changes.ts';
import { ListArtifacts } from './use-cases/list-artifacts.ts';
import { ListCommits } from './use-cases/list-commits.ts';
import { ListDirectory } from './use-cases/list-directory.ts';
import { ListFilePreferences } from './use-cases/list-file-preferences.ts';
import { ListFileTree } from './use-cases/list-file-tree.ts';
import { ListReviewedFiles } from './use-cases/list-reviewed-files.ts';
import { Pairing, type PairingReach } from './use-cases/pairing.ts';
import { PrepareGitAction } from './use-cases/prepare-git-action.ts';
import { ReadAsset } from './use-cases/read-asset.ts';
import { ReadReviewSummary } from './use-cases/read-review-summary.ts';
import { ReadTextFile } from './use-cases/read-text-file.ts';
import { ReadWorktreeDiff } from './use-cases/read-worktree-diff.ts';
import { ReadWorktreeEvidence } from './use-cases/read-worktree-evidence.ts';
import { ReadWorktreeStatus } from './use-cases/read-worktree-status.ts';
import { RefreshProjects } from './use-cases/refresh-projects.ts';
import { RegisterProject } from './use-cases/register-project.ts';
import { RemoveProject } from './use-cases/remove-project.ts';
import { RemoveReviewedFile } from './use-cases/remove-reviewed-file.ts';
import { ReplaceReviewLayers } from './use-cases/replace-review-layers.ts';
import { resolveInspectionWorktree } from './use-cases/resolve-inspection-worktree.ts';
import { SetFilePreference } from './use-cases/set-file-preference.ts';
import { SetReviewedFile } from './use-cases/set-reviewed-file.ts';
import { UploadArtifact } from './use-cases/upload-artifact.ts';

const READ_CAPACITY = 4;
/** How often a device's last-seen time reaches the database. */
const LAST_SEEN_FLUSH_MS = 60_000;
/** A model call is slow and reaches outside; it never holds a lane. */
const GENERATOR_DEADLINE_MS = 120_000;

export async function openApplication(options: {
  dataDirectory: string;
  git?: GitFactory;
  actionGit?: GitActionWriterFactory;
  commitGit?: CommitReaderFactory;
  inspectionGit?: InspectionFactory;
  files?: FileReader;
  projectFolders?: ProjectFolders;
  /** Where discovery and browsing start; the composition root resolves it. */
  projectHome: string;
  /** Where this server answers, as the bound listener reports it. */
  pairingReach?: () => PairingReach;
  commitGenerator?: CommitGenerator;
  fileWriter?: FileWriter;
  now?: () => string;
  signal?: AbortSignal;
  operationTimeoutMs?: number;
}): Promise<Application> {
  const { operationTimeoutMs } = applicationSettingsSchema.parse(options);
  options.signal?.throwIfAborted();
  const database = openDatabase(options.dataDirectory);
  const lanes = new Lanes({
    deadlineMs: operationTimeoutMs,
    readCapacity: READ_CAPACITY,
    closeResources: () => database.close(),
  });
  /** Work that belongs to no repository: browsing and discovery. */
  const FILESYSTEM = 'filesystem';
  /** Reconciling the inventory has one owner, whoever asked for it. */
  const INVENTORY = 'inventory';
  let firstRefreshFailure: unknown;
  const sharedReads = new SharedReads();
  try {
    const layers = new ReviewLayerRepository(database.db);
    const replaceLayers = new ReplaceReviewLayers(layers);
    const store = new InventoryRepository(database.db);
    /** Database work answers immediately; it never enters a lane. */
    const stored = async <T>(read: () => T): Promise<T> => {
      lanes.assertOpen();
      return read();
    };

    /** The repository a worktree belongs to: one lane per repository. */
    const laneOf = (worktreeId: string) => {
      try {
        return resolveInspectionWorktree(store, worktreeId).repositoryIdentity;
      } catch {
        return 'unresolved';
      }
    };
    const projectLaneOf = (projectId: string) =>
      store.read().projects.find((entry) => entry.id === projectId)
        ?.repositoryIdentity ?? 'unresolved';
    const removeProject = new RemoveProject(
      new ProjectRemovalRepository(database.db),
    );
    const actionStore = new GitActionRepository(database.db);
    actionStore.recover();
    const actionGit =
      options.actionGit ?? ((checkout) => new ActionGit(checkout));

    const preferences = new FilePreferenceRepository(database.db);
    const listPreferences = new ListFilePreferences(store, preferences);
    const setPreference = new SetFilePreference(store, preferences);
    const pairingStore = new PairingRepository(database.db);
    // Device digests live in memory because the review forbids per-request SQL;
    // one server owns a data directory, so nothing else can change them.
    const deviceDirectory = new DeviceDirectory(pairingStore);
    // Where this server answers is a listener fact, so the runtime supplies it;
    // the application refuses a pairing link aimed anywhere else.
    const pairing = new Pairing(
      pairingStore,
      deviceDirectory,
      store,
      options.pairingReach ??
        (() => ({ port: 0, policy: { allowedHosts: [], localAddresses: [] } })),
    );
    // Last seen moves per request in memory and reaches SQLite on a timer, so
    // authentication never writes. Unref'd: it must not hold the process open.
    const lastSeenFlush = setInterval(
      () => deviceDirectory.flush(),
      LAST_SEEN_FLUSH_MS,
    );
    lastSeenFlush.unref();
    const artifacts = new ArtifactRepository(database.db);
    const uploadArtifact = new UploadArtifact(artifacts, store);
    const listArtifacts = new ListArtifacts(artifacts, store);
    const getArtifact = new GetArtifact(artifacts, store);
    const deleteArtifact = new DeleteArtifact(artifacts, store);
    const git = options.git ?? ((checkout: string) => new Git(checkout));
    const finder = new FindProjects(
      options.projectFolders ?? new NodeProjectFolders(),
      git,
      store,
      options.projectHome,
    );
    // Read once here rather than per history request; a missing Git still
    // surfaces on the request that needs it, so startup is unaffected.
    void readGitVersion().catch(() => undefined);
    const cursor = new CommitCursorCodec(randomBytes(32));
    const commitGit =
      options.commitGit ?? ((checkout) => new CommitGit(checkout, cursor));
    const commitLayers = new CommitReviewLayerRepository(database.db);
    const associateLayers = new AssociateCommitReviewLayers(
      store,
      layers,
      commitLayers,
      commitGit,
    );
    const getCommitLayers = new GetCommitReviewLayers(store, commitLayers);
    const listCommits = new ListCommits(store, commitGit);
    const inspectCommitChanges = new InspectCommitChanges(store, commitGit);
    const files = options.files ?? new NodeFileReader();
    const list = new ListDirectory(store, git, files);
    const read = new ReadTextFile(store, git, files);
    const asset = new ReadAsset(store, git, new NodeFileReader());
    const fileTree = new ListFileTree(
      store,
      git,
      new NodeFileTree(),
      readTreePaths,
    );
    const editFile = new EditFile(
      store,
      git,
      options.fileWriter ?? new NodeFileWriter(),
    );
    const refresh = new RefreshProjects(store, git);
    const register = new RegisterProject(store, git, refresh);
    const inspection =
      options.inspectionGit ?? ((checkout) => new InspectionGit(checkout));
    const status = new ReadWorktreeStatus(store, inspection);
    const diff = new ReadWorktreeDiff(store, inspection);
    const evidence = new ReadWorktreeEvidence(
      store,
      inspection,
      git,
      files,
      readFileStamps,
    );
    const actions = new GitActionCoordinator(
      lanes,
      projectLaneOf,
      new PrepareGitAction(store, actionStore, actionGit, randomUUID, evidence),
      new AcceptGitAction(actionStore),
      new ExecuteGitAction(
        store,
        actionStore,
        actionGit,
        new CompleteCommitReview(store, layers, commitLayers, commitGit),
      ),
      actionStore,
    );
    const generator = options.commitGenerator ?? new CliCommitGenerator();
    const commitDrafts = new CommitDrafts(
      store,
      actionGit,
      evidence,
      generator,
    );
    const reviewed = new ReviewedFileRepository(database.db);
    const listReviewedFiles = new ListReviewedFiles(reviewed);
    const setReviewedFile = new SetReviewedFile(
      reviewed,
      evidence,
      listReviewedFiles,
    );
    const removeReviewedFile = new RemoveReviewedFile(
      reviewed,
      listReviewedFiles,
    );
    // Availability is persisted, so a project that was reachable at the last
    // shutdown would otherwise keep reporting so while a hung refresh runs.
    store.markAllUnavailable();
    const firstRefresh = lanes
      .run(INVENTORY, 'write', ({ signal }) => refresh.execute(signal), {
        callerSignal: options.signal,
      })
      .then(
        () => undefined,
        (cause: unknown) => {
          // A repository that cannot be read is data, already recorded as
          // unavailable. Anything else is a fault and must not look like
          // success to whoever waits for the first refresh.
          firstRefreshFailure = cause;
        },
      );
    const comments = new CommentThreads(
      new CommentRepository(database.db),
      store,
      randomUUID,
      options.now,
    );
    const summary = new ReadReviewSummary(
      evidence,
      listReviewedFiles,
      comments,
      status,
    );

    return {
      reviewSummary: (worktreeId, signal) =>
        lanes.run(
          laneOf(worktreeId),
          'read',
          ({ signal: ownedSignal }) =>
            summary.execute(worktreeId, new RequestGitSession(), ownedSignal),
          { callerSignal: signal },
        ),
      commitModels: (signal) =>
        lanes.unqueued((operationSignal) => generator.models(operationSignal), {
          callerSignal: signal,
          deadlineMs: GENERATOR_DEADLINE_MS,
        }),
      draftCommits: async (scope, input, signal) => {
        scope = structuredClone(scope);
        input = structuredClone(input);
        const captured = await lanes.run(
          projectLaneOf(scope.projectId),
          'read',
          ({ signal: operationSignal }) =>
            commitDrafts.capture(
              scope,
              input,
              new RequestGitSession(),
              operationSignal,
            ),
          { callerSignal: signal },
        );
        const result = await lanes.unqueued(
          (operationSignal) =>
            commitDrafts.generate(captured, input, operationSignal),
          { callerSignal: signal, deadlineMs: GENERATOR_DEADLINE_MS },
        );
        await lanes.run(
          projectLaneOf(scope.projectId),
          'read',
          ({ signal: operationSignal }) =>
            commitDrafts.verify(
              scope,
              captured.fingerprint,
              new RequestGitSession(),
              operationSignal,
            ),
          { callerSignal: signal },
        );
        return result;
      },
      prepareFetch: (scope, input, signal) =>
        actions.prepareAction(scope, { ...input, action: 'fetch' }, signal),
      executeFetch: (scope, input) =>
        actions.submit(scope, 'fetch', input.requestId, input.preparationId),
      preparePull: (scope, input, signal) =>
        actions.prepareAction(scope, { ...input, action: 'pull' }, signal),
      executePull: (scope, input) =>
        actions.submit(scope, 'pull', input.requestId, input.preparationId),
      preparePush: (scope, input, signal) =>
        actions.prepareAction(scope, { ...input, action: 'push' }, signal),
      executePush: (scope, input) =>
        actions.submit(scope, 'push', input.requestId, input.preparationId),
      prepareCommit: (scope, input, signal) =>
        actions.prepareAction(scope, { ...input, action: 'commit' }, signal),
      executeCommit: (scope, input) =>
        actions.submit(scope, 'commit', input.requestId, input.preparationId),
      prepareStashCreate: (scope, input, signal) =>
        actions.prepareAction(
          scope,
          { ...input, action: 'stash-create' },
          signal,
        ),
      executeStashCreate: (scope, input) =>
        actions.submit(
          scope,
          'stash-create',
          input.requestId,
          input.preparationId,
        ),
      prepareStashApply: (scope, input, signal) =>
        actions.prepareAction(
          scope,
          { ...input, action: 'stash-apply' },
          signal,
        ),
      executeStashApply: (scope, input) =>
        actions.submit(
          scope,
          'stash-apply',
          input.requestId,
          input.preparationId,
        ),
      prepareStashPop: (scope, input, signal) =>
        actions.prepareAction(scope, { ...input, action: 'stash-pop' }, signal),
      executeStashPop: (scope, input) =>
        actions.submit(
          scope,
          'stash-pop',
          input.requestId,
          input.preparationId,
        ),
      gitActionReceipt: (requestId) => actions.receipt(requestId),
      // Sharing sits above the lane: a second identical read joins the first
      // rather than taking a read permit of its own.
      gitStatus: (worktreeId, signal) =>
        sharedReads.run(
          `status\0${laneOf(worktreeId)}\0${worktreeId}`,
          (shared) =>
            lanes.run(
              laneOf(worktreeId),
              'read',
              ({ signal: operationSignal }) =>
                status.execute(
                  worktreeId,
                  new RequestGitSession(),
                  operationSignal,
                ),
              { callerSignal: shared },
            ),
          signal,
        ),
      gitDiff: (worktreeId, expectedStatusToken, selection, signal) => {
        const submitted = {
          scope: selection.scope,
          oldPath: selection.oldPath,
          newPath: selection.newPath,
        };
        return lanes.run(
          laneOf(worktreeId),
          'read',
          ({ signal: operationSignal }) =>
            diff.execute(
              worktreeId,
              expectedStatusToken,
              submitted,
              new RequestGitSession(),
              operationSignal,
            ),
          { callerSignal: signal },
        );
      },
      reviewEvidence: (worktreeId, signal) =>
        lanes.run(
          laneOf(worktreeId),
          'read',
          ({ signal: operationSignal }) =>
            evidence.execute(
              worktreeId,
              new RequestGitSession(),
              operationSignal,
            ),
          { callerSignal: signal },
        ),
      listReviewedFiles: (worktreeId) =>
        stored(() => listReviewedFiles.execute(worktreeId)),
      setReviewedFile: (worktreeId, input, signal) => {
        const submitted = { ...input };
        return lanes.run(
          laneOf(worktreeId),
          'read',
          ({ signal: operationSignal }) =>
            setReviewedFile.execute(
              worktreeId,
              submitted,
              new RequestGitSession(),
              operationSignal,
            ),
          { callerSignal: signal },
        );
      },
      removeReviewedFile: (worktreeId, path) =>
        stored(() => removeReviewedFile.execute(worktreeId, path)),
      fileTree: (worktreeId, signal) =>
        lanes.run(
          laneOf(worktreeId),
          'read',
          ({ signal: operationSignal }) =>
            fileTree.execute(worktreeId, operationSignal),
          { callerSignal: signal },
        ),
      editFile: (worktreeId, command, signal) => {
        const submitted = { ...command };
        return lanes.run(
          laneOf(worktreeId),
          'write',
          ({ signal: operationSignal }) =>
            editFile.execute(worktreeId, submitted, operationSignal),
          { callerSignal: signal },
        );
      },
      listDirectory: (id: string, path: string, signal?: AbortSignal) =>
        lanes.run(
          laneOf(id),
          'read',
          ({ signal: operationSignal }) =>
            list.execute(id, path, operationSignal),
          { callerSignal: signal },
        ),
      readAsset: (id, path, signal) =>
        lanes.run(
          laneOf(id),
          'read',
          ({ signal: operationSignal }) =>
            asset.execute(id, path, operationSignal),
          { callerSignal: signal },
        ),
      readTextFile: (id: string, path: string, signal?: AbortSignal) =>
        lanes.run(
          laneOf(id),
          'read',
          ({ signal: operationSignal }) =>
            read.execute(id, path, operationSignal),
          { callerSignal: signal },
        ),
      removeProject: (projectId, signal) =>
        lanes.run(
          projectLaneOf(projectId),
          'write',
          async () => {
            actions.assertProjectRemovable(projectId);
            return removeProject.execute(projectId);
          },
          { callerSignal: signal },
        ),
      discoverProjects: (signal) =>
        lanes.run(
          FILESYSTEM,
          'read',
          ({ signal: operationSignal }) => finder.discover(operationSignal),
          { callerSignal: signal },
        ),
      browseProjectFolders: (path, signal) =>
        lanes.run(
          FILESYSTEM,
          'read',
          ({ signal: operationSignal }) => finder.browse(path, operationSignal),
          { callerSignal: signal },
        ),
      inventory: () => {
        lanes.assertOpen();
        return store.read();
      },
      register: (checkout: string, signal?: AbortSignal) =>
        lanes.run(
          INVENTORY,
          'write',
          ({ signal: operationSignal }) =>
            register.execute(checkout, operationSignal),
          { callerSignal: signal },
        ),
      refresh: (signal?: AbortSignal) =>
        lanes.run(
          INVENTORY,
          'write',
          ({ signal: operationSignal }) => refresh.execute(operationSignal),
          { callerSignal: signal },
        ),
      listCommits: (worktreeId, request, signal) => {
        const submitted = { ...request };
        return lanes.run(
          laneOf(worktreeId),
          'read',
          ({ signal: operationSignal }) =>
            listCommits.execute(worktreeId, submitted, operationSignal),
          { callerSignal: signal },
        );
      },
      inspectCommitChanges: (worktreeId, request, signal) => {
        const submitted = { ...request };
        return lanes.run(
          laneOf(worktreeId),
          'read',
          ({ signal: operationSignal }) =>
            inspectCommitChanges.execute(
              worktreeId,
              submitted,
              operationSignal,
            ),
          { callerSignal: signal },
        );
      },
      listFilePreferences: (projectId) =>
        stored(() => listPreferences.execute(projectId)),
      setFilePreference: (projectId, change) => {
        const intent = {
          path: change.path,
          flag: change.flag,
          value: change.value,
        };
        return stored(() => setPreference.execute(projectId, intent));
      },
      comments: async (command, principal, signal) => {
        const snapshot = structuredClone(command);
        if (snapshot.kind === 'list') {
          lanes.assertOpen();
          signal?.throwIfAborted();
          return comments.execute(snapshot, principal);
        }
        return stored(() => comments.execute(snapshot, principal));
      },
      commitReviewLayers: (projectId, commitOid) => {
        const params = commitReviewLayerParamsSchema.parse({
          projectId,
          oid: commitOid,
        });
        return stored(() =>
          getCommitLayers.execute(params.projectId, params.oid),
        );
      },
      associateCommitReviewLayers: (projectId, commitOid, request, signal) => {
        const params = commitReviewLayerParamsSchema.parse({
          projectId,
          oid: commitOid,
        });
        const input = associateCommitReviewLayersSchema.parse(request);
        return lanes.run(
          projectLaneOf(params.projectId),
          'read',
          ({ signal: operationSignal }) =>
            associateLayers.execute(
              params.projectId,
              params.oid,
              input,
              operationSignal,
            ),
          { callerSignal: signal },
        );
      },
      reviewLayers: (worktreeId) => {
        lanes.assertOpen();
        return layers.read(
          reviewLayerParamsSchema.parse({ worktreeId }).worktreeId,
        );
      },
      replaceReviewLayers: async (worktreeId, revision, value) => {
        const params = reviewLayerParamsSchema.parse({ worktreeId });
        const input = replaceReviewLayersSchema.parse({
          expectedRevision: revision,
          layers: value,
        });
        return stored(() =>
          replaceLayers.execute(
            params.worktreeId,
            input.expectedRevision,
            input.layers,
          ),
        );
      },
      uploadArtifact: (worktreeId, input) => {
        const submitted = { name: input.name, content: input.content };
        return stored(() => uploadArtifact.execute(worktreeId, submitted));
      },
      listArtifacts: (worktreeId) =>
        stored(() => listArtifacts.execute(worktreeId)),
      getArtifact: (worktreeId, artifactId) =>
        stored(() => getArtifact.execute(worktreeId, artifactId)),
      deleteArtifact: (worktreeId, artifactId) =>
        stored(() => deleteArtifact.execute(worktreeId, artifactId)),
      /** Resolves once the first refresh has settled, however it settled. */
      ready: async () => {
        await firstRefresh;
        if (firstRefreshFailure !== undefined) throw firstRefreshFailure;
      },
      authenticateDevice: (credential, address) =>
        deviceDirectory.authenticate(credential, address),
      holdForDevice: (deviceId, connection) =>
        deviceDirectory.register(deviceId, connection),
      issuePairing: (labels, addresses) =>
        stored(() => pairing.issue(labels, addresses)),
      listAccess: () => stored(() => pairing.listing()),
      revokeAccess: (id) => stored(() => pairing.revoke(id)),
      redeemPairing: (code, registration) =>
        stored(() => pairing.redeem(code, registration)),
      close: async () => {
        clearInterval(lastSeenFlush);
        // The last flush has to happen while the database is still open.
        try {
          deviceDirectory.flush();
        } catch {
          // A failed final flush costs precision in "last seen", never access.
        }
        await lanes.close();
      },
    };
  } catch (error) {
    await lanes.close();
    throw error;
  }
}
