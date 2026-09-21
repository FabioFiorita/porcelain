import { randomUUID } from 'node:crypto';
import { renameProjectRequestSchema } from '@porcelain/contracts/inventory';
import {
  replaceReviewLayersSchema,
  reviewLayerParamsSchema,
} from '@porcelain/contracts/review-layers';
import { ActionGit } from '@porcelain/git/action-git';
import { checkIgnored } from '@porcelain/git/commands/check-ignored';
import { listTrackedPaths } from '@porcelain/git/commands/list-tracked-paths';
import { CommitGit } from '@porcelain/git/commit-git';
import type { DiscoveryIssue } from '@porcelain/git/dtos/discovery-issue';
import { Git } from '@porcelain/git/git';
import { RequestGitSession } from '@porcelain/git/git-session';
import { InspectionGit } from '@porcelain/git/inspection-git';
import type { CommitReaderFactory } from '@porcelain/git/interfaces/commit-reader';
import type { GitActionWriterFactory } from '@porcelain/git/interfaces/git-action-writer';
import type { GitFactory } from '@porcelain/git/interfaces/git-factory';
import type { InspectionFactory } from '@porcelain/git/interfaces/inspection-factory';
import { readGitVersion } from '@porcelain/git/read-git-version';
import { CliCommitGenerator } from './agents/cli-commit-generator.ts';
import type { CommitGenerator } from './agents/interfaces/commit-generator.ts';
import type { Application } from './application.ts';
import { applicationSettingsSchema } from './config/application-settings.ts';
import { openDatabase } from './db/connection.ts';
import { NodeFileReader } from './filesystem/file-reader.ts';
import { NodeFileWriter } from './filesystem/file-writer.ts';
import type { FileReader } from './filesystem/interfaces/file-reader.ts';
import type { FileWriter } from './filesystem/interfaces/file-writer.ts';
import type { IgnoredEntries } from './filesystem/interfaces/ignored-entries.ts';
import type { ProjectFolders } from './filesystem/interfaces/project-folders.ts';
import type {
  StampPath,
  WorktreeFiles,
} from './filesystem/interfaces/worktree-files.ts';
import { NodeProjectFolders } from './filesystem/project-folders.ts';
import { readWorktreeFiles, stampPath } from './filesystem/worktree-files.ts';
import { DeviceDirectory } from './lifecycle/device-directory.ts';
import { GitActionCoordinator } from './lifecycle/git-action-coordinator.ts';
import { Lanes } from './lifecycle/lanes.ts';
import { LaunchLimit } from './lifecycle/launch-limit.ts';
import { LiveUpdates } from './lifecycle/live-updates.ts';
import { SharedReads } from './lifecycle/shared-reads.ts';
import { WorktreeDirectory } from './lifecycle/worktree-directory.ts';
import type { Project } from './models/project.ts';
import { ArtifactRepository } from './repositories/artifact-repository.ts';
import { CommentRepository } from './repositories/comment-repository.ts';
import { FilePreferenceRepository } from './repositories/file-preference-repository.ts';
import { GitActionRepository } from './repositories/git-action-repository.ts';
import { InventoryRepository } from './repositories/inventory-repository.ts';
import { PairingRepository } from './repositories/pairing-repository.ts';
import { ProjectRemovalRepository } from './repositories/project-removal-repository.ts';
import { ReviewLayerRepository } from './repositories/review-layer-repository.ts';
import { ReviewedFileRepository } from './repositories/reviewed-file-repository.ts';
import { WorktreePresenceRepository } from './repositories/worktree-presence-repository.ts';
import { WorktreeStatusRepository } from './repositories/worktree-status-repository.ts';
import { AcceptGitAction } from './use-cases/accept-git-action.ts';
import { CollectAbsentWorktrees } from './use-cases/collect-absent-worktrees.ts';
import { CommentThreads } from './use-cases/comment-threads.ts';
import { CommitDrafts } from './use-cases/commit-drafts.ts';
import { CompleteCommitReview } from './use-cases/complete-commit-review.ts';
import { DeleteArtifact } from './use-cases/delete-artifact.ts';
import { EditFile } from './use-cases/edit-file.ts';
import { ExecuteGitAction } from './use-cases/execute-git-action.ts';
import { FindProjects } from './use-cases/find-projects.ts';
import { GetArtifact } from './use-cases/get-artifact.ts';
import { ListArtifacts } from './use-cases/list-artifacts.ts';
import { ListCommits } from './use-cases/list-commits.ts';
import { ListDirectory } from './use-cases/list-directory.ts';
import { ListFilePreferences } from './use-cases/list-file-preferences.ts';
import { ListReviewedFiles } from './use-cases/list-reviewed-files.ts';
import {
  ListWorktreePaths,
  type TrackedPaths,
} from './use-cases/list-worktree-paths.ts';
import { MarkCommentsSeen } from './use-cases/mark-comments-seen.ts';
import { Pairing, type PairingReach } from './use-cases/pairing.ts';
import { PrepareGitAction } from './use-cases/prepare-git-action.ts';
import { ReadAsset } from './use-cases/read-asset.ts';
import { ReadChangeDiffs } from './use-cases/read-change-diffs.ts';
import { ReadChangeLines } from './use-cases/read-change-lines.ts';
import { ReadCommitFiles } from './use-cases/read-commit-files.ts';
import { ReadPreviewAssets } from './use-cases/read-preview-assets.ts';
import { ReadTextFile } from './use-cases/read-text-file.ts';
import { ReadWorktreeChanges } from './use-cases/read-worktree-changes.ts';
import { ReadWorktreeStatus } from './use-cases/read-worktree-status.ts';
import { RegisterProject } from './use-cases/register-project.ts';
import { RemoveProject } from './use-cases/remove-project.ts';
import { RemoveReviewedFile } from './use-cases/remove-reviewed-file.ts';
import { RenameProject } from './use-cases/rename-project.ts';
import { ReplaceReviewLayers } from './use-cases/replace-review-layers.ts';
import { ResolveWorktree } from './use-cases/resolve-worktree.ts';
import { SetFilePreference } from './use-cases/set-file-preference.ts';
import { SetReviewedFile } from './use-cases/set-reviewed-file.ts';
import { UploadArtifact } from './use-cases/upload-artifact.ts';

const READ_CAPACITY = 4;
/**
 * How many `git worktree list` processes may run at once, over the whole
 * server. Its own policy: it happens to equal the read capacity, but one
 * bounds requests waiting on a repository and this bounds child processes.
 */
const LISTING_LAUNCHES = 4;
/** How often a device's last-seen time reaches the database. */
const LAST_SEEN_FLUSH_MS = 60_000;
/** Review data outlives its worktree by thirty days; hourly is ample. */
const COLLECTION_INTERVAL_MS = 60 * 60_000;
/** A model call is slow and reaches outside; it never holds a lane. */
const GENERATOR_DEADLINE_MS = 120_000;

export async function openApplication(options: {
  dataDirectory: string;
  git?: GitFactory;
  actionGit?: GitActionWriterFactory;
  commitGit?: CommitReaderFactory;
  inspectionGit?: InspectionFactory;
  files?: FileReader;
  worktreeFiles?: WorktreeFiles;
  ignoredEntries?: (root: string) => IgnoredEntries;
  trackedPaths?: TrackedPaths;
  stampPath?: StampPath;
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
  projectListingTimeoutMs?: number;
}): Promise<Application> {
  const { operationTimeoutMs, projectListingTimeoutMs } =
    applicationSettingsSchema.parse(options);
  options.signal?.throwIfAborted();
  const database = openDatabase(options.dataDirectory);
  // Set once the inventory store exists; until then there is nothing to count.
  let countProjects = () => 0;
  /**
   * Long enough for every wave of projects to reach its own deadline.
   *
   * A fixed deadline would abort a request once there are more slow projects
   * than the launch limit can start at once — which is the failure the
   * per-project timeout exists to remove. Every lane operation gets this,
   * because any of them can end up listing: a worktree id the directory has
   * not seen is resolved by listing every project.
   */
  const listingBudgetMs = () =>
    Math.ceil(Math.max(countProjects(), 1) / LISTING_LAUNCHES) *
      projectListingTimeoutMs +
    operationTimeoutMs;
  const lanes = new Lanes({
    deadlineMs: listingBudgetMs,
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
    const store = new InventoryRepository(database.db);
    // The lane deadline counts projects; a lane asserts it is open before it
    // asks, so this never reads a closed database.
    countProjects = () => store.read().projects.length;
    const git = options.git ?? ((checkout: string) => new Git(checkout));
    // Git is the source of truth for worktrees: this lists them and turns an
    // id back into one, without SQLite and usually without a Git process.
    const launches = new LaunchLimit(LISTING_LAUNCHES);
    const directory = new WorktreeDirectory({
      git,
      reads: sharedReads,
      launches,
      timeoutMs: projectListingTimeoutMs,
      projects: () => store.read().projects,
    });
    const presence = new WorktreePresenceRepository(database.db);
    const statuses = new WorktreeStatusRepository(database.db);
    const collectAbsent = new CollectAbsentWorktrees(
      presence,
      options.now ? () => Date.parse(options.now?.() ?? '') : undefined,
    );
    const worktrees = new ResolveWorktree(directory, store, presence);
    const replaceLayers = new ReplaceReviewLayers(layers, worktrees);

    /**
     * Every project, with the worktrees Git lists for it right now.
     *
     * One coalesced `git worktree list` per project. A project that cannot be
     * listed is recorded unavailable and keeps its last-known worktrees, and
     * its presence rows are left alone: absence is only ever observed by a
     * listing that worked.
     */
    const listProjects = async (signal?: AbortSignal) => {
      const registered = store.read().projects;
      // Listed together, recorded in stored order: how fast a repository
      // answers must not decide where it sits in the sidebar.
      const listings = await Promise.all(
        registered.map((project) => directory.list(project, signal)),
      );
      const issues: DiscoveryIssue[] = [];
      const projects: Project[] = [];
      // Removal runs on the project's own lane, so it can land while these
      // listings are in flight. Whatever is still registered when they finish
      // is what this answers with: writing back availability for a project
      // that has gone would put it back in the sidebar without its data.
      const present = new Set(
        store.read().projects.map((project) => project.id),
      );
      // One read for every worktree of every project: the dot costs a single
      // statement, which is what replacing the per-worktree count was for.
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
        // A listing that is short by a worktree cannot say that worktree is
        // gone: absence is only ever observed from the whole truth.
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
    /**
     * Long enough for every wave of projects to reach its own deadline.
     *
     * A fixed operation deadline would abort the whole request once there are
     * more slow projects than the launch limit can start at once — which is
     * the failure the per-project timeout exists to remove.
     */
    /** Database work answers immediately; it never enters a lane. */
    const stored = async <T>(read: () => T | Promise<T>): Promise<T> => {
      lanes.assertOpen();
      return read();
    };

    /**
     * Review data for one worktree.
     *
     * The work is SQLite, but asking whether the worktree exists can reach
     * Git: an id the directory has not seen costs a listing. So it takes an
     * admission like everything else that might run a process — otherwise it
     * would run outside the deadline, outside the read budget, and outside
     * the drain that shutdown waits on before closing the database.
     */
    const forWorktree = <T>(
      read: (signal: AbortSignal) => T | Promise<T>,
      signal?: AbortSignal,
    ): Promise<T> =>
      // Unqueued on purpose: a repository permit would put this behind real
      // Git work, and holding one while several of these run together stops
      // the reads they trigger from sharing a single answer — the difference
      // between reselecting a worktree for 16 Git processes and for 155.
      lanes.unqueued(async (operationSignal) => read(operationSignal), {
        callerSignal: signal,
      });

    /**
     * The repository a worktree belongs to: one lane per repository.
     *
     * Lanes are chosen before the work runs, so this answers from what the
     * directory already knows. An id it has never seen goes to the unresolved
     * lane and the request itself then fails to resolve, which is the same
     * outcome as before without making lane choice wait on Git.
     */
    const laneOf = (worktreeId: string) =>
      directory.repositoryOf(worktreeId) ?? 'unresolved';
    const projectLaneOf = (projectId: string) =>
      store.read().projects.find((entry) => entry.id === projectId)
        ?.repositoryIdentity ?? 'unresolved';
    const renameProject = new RenameProject(store);
    const markSeen = new MarkCommentsSeen(worktrees, statuses);
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
    // Listing is what observes absence, so collection follows it on the same
    // timer rather than on a schedule of its own.
    const collection = setInterval(() => {
      try {
        collectAbsent.execute();
      } catch {
        // Cleanup is housekeeping: a failure must not take the server with it.
      }
    }, COLLECTION_INTERVAL_MS);
    collection.unref();
    const artifacts = new ArtifactRepository(database.db);
    const uploadArtifact = new UploadArtifact(artifacts, worktrees);
    const listArtifacts = new ListArtifacts(artifacts, worktrees);
    const getArtifact = new GetArtifact(artifacts, worktrees);
    const deleteArtifact = new DeleteArtifact(artifacts, worktrees);
    const finder = new FindProjects(
      options.projectFolders ?? new NodeProjectFolders(),
      git,
      store,
      options.projectHome,
    );
    // Read once here rather than per history request; a missing Git still
    // surfaces on the request that needs it, so startup is unaffected.
    void readGitVersion().catch(() => undefined);
    const commitGit =
      options.commitGit ?? ((checkout) => new CommitGit(checkout));
    const listCommits = new ListCommits(store, worktrees, commitGit);
    const commitFiles = new ReadCommitFiles(store, worktrees, commitGit);
    const files = options.files ?? new NodeFileReader();
    // The ignore question runs through the same session guard every other Git
    // read uses, and only for the entries of the folder being opened.
    // One Git process per folder opened, for the entries of that folder only.
    // The read that calls it establishes the worktree by stat on both sides
    // and verifies the directory around it, so this needs no guard of its own.
    const list = new ListDirectory(
      worktrees,
      files,
      options.ignoredEntries ??
        ((root) => (paths, signal) => checkIgnored(root, paths, signal)),
    );
    const read = new ReadTextFile(worktrees, files);
    const asset = new ReadAsset(worktrees, new NodeFileReader());
    const previewAssets = new ReadPreviewAssets(
      worktrees,
      new NodeFileReader(),
    );
    const worktreePaths = new ListWorktreePaths(
      worktrees,
      options.trackedPaths ?? listTrackedPaths,
    );
    const editFile = new EditFile(
      worktrees,
      options.fileWriter ?? new NodeFileWriter(),
    );
    const register = new RegisterProject(store, git, directory);
    const inspection =
      options.inspectionGit ?? ((checkout) => new InspectionGit(checkout));
    const status = new ReadWorktreeStatus(store, worktrees, inspection);
    const worktreeFiles = options.worktreeFiles ?? readWorktreeFiles;
    const changes = new ReadWorktreeChanges(
      store,
      worktrees,
      inspection,
      worktreeFiles,
    );
    const changeDiffs = new ReadChangeDiffs(
      store,
      worktrees,
      inspection,
      worktreeFiles,
      options.stampPath ?? stampPath,
    );
    // A snippet of a working file is a file read, through the same no-follow
    // boundary the Files surface uses and under the same size bound.
    const changeLines = new ReadChangeLines(
      store,
      worktrees,
      inspection,
      files,
    );
    const actions = new GitActionCoordinator(
      lanes,
      projectLaneOf,
      new PrepareGitAction(
        store,
        worktrees,
        actionStore,
        actionGit,
        randomUUID,
        changes,
      ),
      new AcceptGitAction(actionStore),
      new ExecuteGitAction(
        store,
        worktrees,
        actionStore,
        actionGit,
        new CompleteCommitReview(store, worktrees, layers, commitGit),
      ),
      actionStore,
    );
    const generator = options.commitGenerator ?? new CliCommitGenerator();
    const commitDrafts = new CommitDrafts(
      store,
      worktrees,
      actionGit,
      changes,
      changeDiffs,
      files,
      generator,
    );
    const reviewed = new ReviewedFileRepository(database.db);
    const live = new LiveUpdates({
      worktrees,
      reviewed,
      projects: () => store.read().projects,
    });
    const listReviewedFiles = new ListReviewedFiles(reviewed, worktrees);
    const setReviewedFile = new SetReviewedFile(
      reviewed,
      worktrees,
      changes,
      listReviewedFiles,
    );
    const removeReviewedFile = new RemoveReviewedFile(
      reviewed,
      worktrees,
      listReviewedFiles,
    );
    // Availability is persisted, so a project that was reachable at the last
    // shutdown would otherwise keep reporting so until a listing answers.
    store.markAllUnavailable();
    const firstRefresh = lanes
      .run(INVENTORY, 'write', ({ signal }) => listProjects(signal), {
        callerSignal: options.signal,
      })
      .then(
        () => undefined,
        (cause: unknown) => {
          // A repository that cannot be read is data, already recorded as
          // unavailable. Anything else is a fault and must not look like
          // success to whoever waits for the first listing.
          firstRefreshFailure = cause;
        },
      );
    const comments = new CommentThreads(
      new CommentRepository(database.db),
      worktrees,
      randomUUID,
      options.now,
    );

    return {
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
      changes: (worktreeId, signal) =>
        lanes.run(
          laneOf(worktreeId),
          'read',
          async ({ signal: operationSignal }) => {
            const answer = await changes.execute(
              worktreeId,
              new RequestGitSession(),
              operationSignal,
            );
            reviewed.reconcile(
              worktreeId,
              new Map(
                answer.changes.map((entry) => [entry.path, entry.fingerprint]),
              ),
            );
            return answer;
          },
          { callerSignal: signal },
        ),
      changeDiffs: (
        worktreeId,
        expectedStatusToken,
        expectedFiles,
        selections,
        signal,
      ) => {
        const submitted = selections.map((selection) => ({
          scope: selection.scope,
          oldPath: selection.oldPath,
          newPath: selection.newPath,
        }));
        const expected = expectedFiles.map((file) => ({
          path: file.path,
          fingerprint: file.fingerprint,
        }));
        return lanes.run(
          laneOf(worktreeId),
          'read',
          ({ signal: operationSignal }) =>
            changeDiffs.execute(
              worktreeId,
              expectedStatusToken,
              expected,
              submitted,
              new RequestGitSession(),
              operationSignal,
            ),
          { callerSignal: signal },
        );
      },
      changeLines: (worktreeId, range, signal) => {
        const submitted = { ...range };
        return lanes.run(
          laneOf(worktreeId),
          'read',
          ({ signal: operationSignal }) =>
            changeLines.execute(
              worktreeId,
              submitted,
              new RequestGitSession(),
              operationSignal,
            ),
          { callerSignal: signal },
        );
      },
      listReviewedFiles: (worktreeId, signal) =>
        forWorktree(
          (operationSignal) =>
            listReviewedFiles.execute(worktreeId, operationSignal),
          signal,
        ),
      setReviewedFile: (worktreeId, input, signal) => {
        const submitted = { ...input };
        return lanes
          .run(
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
          )
          .then((answer) => {
            live.publishWorktree(worktreeId, 'reviewed');
            return answer;
          });
      },
      removeReviewedFile: (worktreeId, path, signal) =>
        forWorktree(
          (operationSignal) =>
            removeReviewedFile.execute(worktreeId, path, operationSignal),
          signal,
        ).then((answer) => {
          live.publishWorktree(worktreeId, 'reviewed');
          return answer;
        }),
      worktreePaths: (worktreeId, signal) =>
        lanes.run(
          laneOf(worktreeId),
          'read',
          ({ signal: operationSignal }) =>
            worktreePaths.execute(worktreeId, operationSignal),
          { callerSignal: signal },
        ),
      editFile: (worktreeId, command, signal) => {
        const submitted = { ...command };
        return lanes
          .run(
            laneOf(worktreeId),
            'write',
            ({ signal: operationSignal }) =>
              editFile.execute(worktreeId, submitted, operationSignal),
            { callerSignal: signal },
          )
          .then((answer) => {
            const paths =
              submitted.kind === 'move'
                ? [submitted.path, submitted.destination]
                : [submitted.path];
            live.noteFiles(worktreeId, paths);
            return answer;
          });
      },
      listDirectory: (id: string, path: string, signal?: AbortSignal) =>
        lanes.run(
          laneOf(id),
          'read',
          ({ signal: operationSignal }) =>
            list.execute(id, path, operationSignal),
          { callerSignal: signal },
        ),
      previewAssets: (id, document, paths, signal) => {
        const wanted = [...paths];
        return lanes.run(
          laneOf(id),
          'read',
          ({ signal: operationSignal }) =>
            previewAssets.execute(id, document, wanted, operationSignal),
          { callerSignal: signal },
        );
      },
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
        lanes
          .run(
            projectLaneOf(projectId),
            'write',
            async () => {
              const removal = removeProject.execute(projectId);
              if (removal.deleted) {
                // The checkouts stay on disk, so the directory would go on
                // resolving ids for a project that is gone.
                directory.forget(projectId);
                // Its refusal latch went with it; the coordinator must not keep
                // refusing actions for an id that no longer exists.
                actions.forget(projectId);
              }
              return removal;
            },
            { callerSignal: signal },
          )
          .then((answer) => {
            if (answer.deleted) live.publish({ type: 'inventory' });
            return answer;
          }),
      renameProject: async (projectId, name, signal) => {
        // Parsed here, not only at the route: a name reaches storage the same
        // way whichever door it came through.
        const input = renameProjectRequestSchema.parse({ name });
        return lanes
          .run(
            INVENTORY,
            'write',
            async () => renameProject.execute(projectId, input.name),
            { callerSignal: signal },
          )
          .then((answer) => {
            live.publish({ type: 'inventory' });
            return answer;
          });
      },
      markCommentsSeen: (worktreeId, throughRevision, signal) =>
        forWorktree(
          (operationSignal) =>
            markSeen.execute(worktreeId, throughRevision, operationSignal),
          signal,
        ).then((answer) => {
          live.publishWorktree(worktreeId, 'comments');
          return answer;
        }),
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
      /** Environment and projects only: no Git, so health can call it. */
      environment: () => {
        lanes.assertOpen();
        return store.read();
      },
      inventory: async (signal?: AbortSignal) =>
        lanes.run(
          INVENTORY,
          'read',
          ({ signal: operationSignal }) => listProjects(operationSignal),
          { callerSignal: signal },
        ),
      register: async (checkout: string, signal?: AbortSignal) =>
        lanes
          .run(
            INVENTORY,
            'write',
            async ({ signal: operationSignal }) => {
              const registered = await register.execute(
                checkout,
                operationSignal,
              );
              // The reply carries the sidebar's dots too: a repository added
              // back keeps whatever review data it already had.
              const dots = statuses.status(
                registered.project.worktrees.map((worktree) => worktree.id),
              );
              return {
                ...registered,
                project: {
                  ...registered.project,
                  worktrees: registered.project.worktrees.map((worktree) => ({
                    ...worktree,
                    status: dots.get(worktree.id) ?? null,
                  })),
                },
              };
            },
            // Registering re-lists the projects that claim these paths, so it
            // waits on the same waves an inventory read does.
            { callerSignal: signal },
          )
          .then((answer) => {
            live.publish({ type: 'inventory' });
            return answer;
          }),
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
      commitFiles: (worktreeId, request, signal) => {
        const submitted = { ...request };
        return lanes.run(
          laneOf(worktreeId),
          'read',
          ({ signal: operationSignal }) =>
            commitFiles.files(worktreeId, submitted, operationSignal),
          { callerSignal: signal },
        );
      },
      commitDiffs: (worktreeId, request, signal) => {
        const submitted = { ...request, paths: [...request.paths] };
        return lanes.run(
          laneOf(worktreeId),
          'read',
          ({ signal: operationSignal }) =>
            commitFiles.diffs(worktreeId, submitted, operationSignal),
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
        return stored(() => setPreference.execute(projectId, intent)).then(
          (answer) => {
            live.publish({
              type: 'project',
              projectId,
              change: 'preferences',
            });
            return answer;
          },
        );
      },
      comments: async (command, principal, signal) => {
        const snapshot = structuredClone(command);
        return forWorktree(
          (operationSignal) =>
            comments.execute(snapshot, principal, operationSignal),
          signal,
        ).then((answer) => {
          if (snapshot.kind !== 'list')
            live.publishWorktree(snapshot.worktreeId, 'comments');
          return answer;
        });
      },
      reviewLayers: async (worktreeId, signal) => {
        const params = reviewLayerParamsSchema.parse({ worktreeId });
        // Reading layers asks the same existence question as everything else,
        // so an id Git does not list is not found rather than empty.
        return forWorktree(async (operationSignal) => {
          await worktrees.known(params.worktreeId, operationSignal);
          return layers.read(params.worktreeId);
        }, signal);
      },
      replaceReviewLayers: async (worktreeId, revision, value, signal) => {
        const params = reviewLayerParamsSchema.parse({ worktreeId });
        const input = replaceReviewLayersSchema.parse({
          expectedRevision: revision,
          layers: value,
        });
        return forWorktree(
          (operationSignal) =>
            replaceLayers.execute(
              params.worktreeId,
              input.expectedRevision,
              input.layers,
              operationSignal,
            ),
          signal,
        ).then((answer) => {
          live.publishWorktree(worktreeId, 'layers');
          return answer;
        });
      },
      uploadArtifact: (worktreeId, input, signal) => {
        const submitted = { name: input.name, content: input.content };
        return forWorktree(
          (operationSignal) =>
            uploadArtifact.execute(worktreeId, submitted, operationSignal),
          signal,
        ).then((answer) => {
          live.publishWorktree(worktreeId, 'artifacts');
          return answer;
        });
      },
      listArtifacts: (worktreeId, signal) =>
        forWorktree(
          (operationSignal) =>
            listArtifacts.execute(worktreeId, operationSignal),
          signal,
        ),
      getArtifact: (worktreeId, artifactId, signal) =>
        forWorktree(
          (operationSignal) =>
            getArtifact.execute(worktreeId, artifactId, operationSignal),
          signal,
        ),
      deleteArtifact: (worktreeId, artifactId, signal) =>
        forWorktree(
          (operationSignal) =>
            deleteArtifact.execute(worktreeId, artifactId, operationSignal),
          signal,
        ).then((answer) => {
          if (answer.deleted) live.publishWorktree(worktreeId, 'artifacts');
          return answer;
        }),
      liveUpdates: (send) => live.connect(send),
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
        clearInterval(collection);
        // The last flush has to happen while the database is still open.
        try {
          deviceDirectory.flush();
        } catch {
          // A failed final flush costs precision in "last seen", never access.
        }
        await live.close();
        await lanes.close();
      },
    };
  } catch (error) {
    await lanes.close();
    throw error;
  }
}
