import { randomUUID } from 'node:crypto';
import { renameProjectRequestSchema } from '@porcelain/contracts/inventory';
import {
  publishReviewSchema,
  reviewParamsSchema,
} from '@porcelain/contracts/review';
import { setReviewedLayerRequestSchema } from '@porcelain/contracts/reviewed-files';
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
import { toGitActionReceipt } from './http/mappers/git-action-response.ts';
import { DeviceDirectory } from './lifecycle/device-directory.ts';
import { GitActionCoordinator } from './lifecycle/git-action-coordinator.ts';
import { Lanes } from './lifecycle/lanes.ts';
import { LaunchLimit } from './lifecycle/launch-limit.ts';
import { LiveUpdates } from './lifecycle/live-updates.ts';
import { SharedReads } from './lifecycle/shared-reads.ts';
import { WorktreeDirectory } from './lifecycle/worktree-directory.ts';
import type { CommitModel } from './models/commit-draft.ts';
import type { Project } from './models/project.ts';
import { CommentRepository } from './repositories/comment-repository.ts';
import { FilePreferenceRepository } from './repositories/file-preference-repository.ts';
import { GitActionRepository } from './repositories/git-action-repository.ts';
import { InventoryRepository } from './repositories/inventory-repository.ts';
import { PairingRepository } from './repositories/pairing-repository.ts';
import { ProjectRemovalRepository } from './repositories/project-removal-repository.ts';
import { ReviewRepository } from './repositories/review-repository.ts';
import { ReviewedFileRepository } from './repositories/reviewed-file-repository.ts';
import { ReviewedLayerRepository } from './repositories/reviewed-layer-repository.ts';
import { WorktreePresenceRepository } from './repositories/worktree-presence-repository.ts';
import { WorktreeStatusRepository } from './repositories/worktree-status-repository.ts';
import { CollectAbsentWorktrees } from './use-cases/collect-absent-worktrees.ts';
import { CommentThreads } from './use-cases/comment-threads.ts';
import { CommitDrafts } from './use-cases/commit-drafts.ts';
import { EditFile } from './use-cases/edit-file.ts';
import { CommitDraftError } from './use-cases/errors/commit-draft-error.ts';
import { ExecuteGitAction } from './use-cases/execute-git-action.ts';
import { FindProjects } from './use-cases/find-projects.ts';
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
import {
  PublishedReview,
  verifySummarySignature,
} from './use-cases/published-review.ts';
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
import { resolveActionCheckout } from './use-cases/resolve-action-worktree.ts';
import { ResolveWorktree } from './use-cases/resolve-worktree.ts';
import { SetFilePreference } from './use-cases/set-file-preference.ts';
import { SetReviewedFile } from './use-cases/set-reviewed-file.ts';
import { SetReviewedFiles } from './use-cases/set-reviewed-files.ts';

const READ_CAPACITY = 4;
const LISTING_LAUNCHES = 4;
const LAST_SEEN_FLUSH_MS = 60_000;
const COLLECTION_INTERVAL_MS = 60 * 60_000;
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
  projectHome: string;
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
  let countProjects = () => 0;
  const listingBudgetMs = () =>
    Math.ceil(Math.max(countProjects(), 1) / LISTING_LAUNCHES) *
      projectListingTimeoutMs +
    operationTimeoutMs;
  const lanes = new Lanes({
    deadlineMs: listingBudgetMs,
    readCapacity: READ_CAPACITY,
    closeResources: () => database.close(),
  });
  const FILESYSTEM = 'filesystem';
  const INVENTORY = 'inventory';
  let firstRefreshFailure: unknown;
  const sharedReads = new SharedReads();
  try {
    const store = new InventoryRepository(database.db);
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
    const presence = new WorktreePresenceRepository(database.db);
    const statuses = new WorktreeStatusRepository(database.db);
    const collectAbsent = new CollectAbsentWorktrees(
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
    const deviceDirectory = new DeviceDirectory(pairingStore);
    const pairing = new Pairing(
      pairingStore,
      deviceDirectory,
      store,
      options.pairingReach ??
        (() => ({ port: 0, policy: { allowedHosts: [], localAddresses: [] } })),
    );
    const lastSeenFlush = setInterval(
      () => deviceDirectory.flush(),
      LAST_SEEN_FLUSH_MS,
    );
    lastSeenFlush.unref();
    const collection = setInterval(() => {
      try {
        collectAbsent.execute();
      } catch {
      }
    }, COLLECTION_INTERVAL_MS);
    collection.unref();
    const finder = new FindProjects(
      options.projectFolders ?? new NodeProjectFolders(),
      git,
      store,
      options.projectHome,
    );
    void readGitVersion().catch(() => undefined);
    const commitGit =
      options.commitGit ?? ((checkout) => new CommitGit(checkout));
    const listCommits = new ListCommits(store, worktrees, commitGit);
    const commitFiles = new ReadCommitFiles(store, worktrees, commitGit);
    const files = options.files ?? new NodeFileReader();
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
    const changeLines = new ReadChangeLines(
      store,
      worktrees,
      inspection,
      files,
    );
    const reviewStore = new ReviewRepository(database.db);
    const publishedReview = new PublishedReview(
      reviewStore,
      worktrees,
      read,
      changes,
      changeDiffs,
      () => store.read().environmentId,
      () => new RequestGitSession(),
      options.now,
    );
    const reviewedLayers = new ReviewedLayerRepository(database.db);
    const reviewed = new ReviewedFileRepository(database.db);
    const live = new LiveUpdates({
      worktrees,
      reviewed,
      reviewedLayers,
      projects: () => store.read().projects,
    });
    const actions = new GitActionCoordinator(
      lanes,
      projectLaneOf,
      new ExecuteGitAction(
        store,
        worktrees,
        actionStore,
        actionGit,
        async (worktreeId, signal) => {
          await publishedReview.read(worktreeId, signal);
        },
        changes,
      ),
      actionStore,
      (receipt) =>
        live.publish({
          type: 'git-action',
          projectId: receipt.projectId,
          worktreeId: receipt.worktreeId,
          receipt: toGitActionReceipt(receipt),
        }),
    );
    const generator = options.commitGenerator ?? new CliCommitGenerator();
    let modelList: Promise<CommitModel[]> | undefined;
    const activeDrafts = new Set<string>();
    const commitDrafts = new CommitDrafts(
      store,
      worktrees,
      actionGit,
      changes,
      changeDiffs,
      files,
      generator,
    );
    const listReviewedFiles = new ListReviewedFiles(reviewed, worktrees);
    const setReviewedFile = new SetReviewedFile(
      reviewed,
      worktrees,
      changes,
      listReviewedFiles,
    );
    const setReviewedFiles = new SetReviewedFiles(
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
    const comments = new CommentThreads(
      new CommentRepository(database.db),
      worktrees,
      randomUUID,
      options.now,
    );

    return {
      runGitAction: (scope, request) => actions.run(scope, request),
      gitBranches: (scope, signal) =>
        lanes.run(
          projectLaneOf(scope.projectId),
          'read',
          async ({ signal: operationSignal }) => {
            const { checkout } = await resolveActionCheckout(
              worktrees,
              store,
              new RequestGitSession(),
              scope,
              operationSignal,
            );
            const writer = actionGit(checkout);
            if (!writer.listBranches)
              throw new Error('Branch listing is unavailable');
            return writer.listBranches(operationSignal);
          },
          { callerSignal: signal },
        ),
      commitModels: (_signal) =>
        (modelList ??= lanes.unqueued(
          (operationSignal) => generator.models(operationSignal),
          { deadlineMs: GENERATOR_DEADLINE_MS },
        )),
      draftCommits: async (scope, input, signal) => {
        scope = structuredClone(scope);
        input = structuredClone(input);
        if (activeDrafts.has(scope.worktreeId))
          throw new CommitDraftError(
            'A commit draft is already running for this worktree.',
          );
        activeDrafts.add(scope.worktreeId);
        try {
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
          return await lanes.unqueued(
            (operationSignal) =>
              commitDrafts.generate(captured, input, operationSignal),
            { callerSignal: signal, deadlineMs: GENERATOR_DEADLINE_MS },
          );
        } finally {
          activeDrafts.delete(scope.worktreeId);
        }
      },
      gitActionReceipt: (requestId) => actions.receipt(requestId),
      dismissInterrupted: (scope, requestId) =>
        actions.dismissInterrupted(scope, requestId),
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
            const interrupted = actions.interrupted(worktreeId);
            if (!interrupted) return answer;
            const branch = answer.branch?.name ?? 'detached HEAD';
            const conflicts = answer.changes.filter((change) =>
              change.comparisons.some(
                (comparison) => comparison.scope === 'unmerged',
              ),
            ).length;
            const state = conflicts
              ? `${conflicts} unresolved ${conflicts === 1 ? 'path remains' : 'paths remain'} on ${branch}.`
              : answer.changes.length
                ? `${answer.changes.length} changed ${answer.changes.length === 1 ? 'path remains' : 'paths remain'} on ${branch}.`
                : `The worktree is clean on ${branch}.`;
            return {
              ...answer,
              interrupted: {
                requestId: interrupted.requestId,
                action: interrupted.action,
                gitState: state,
              },
            };
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
      setReviewedFiles: (worktreeId, input, signal) => {
        const submitted = {
          files: input.files.map((file) => ({ ...file })),
        };
        return lanes
          .run(
            laneOf(worktreeId),
            'read',
            ({ signal: operationSignal }) =>
              setReviewedFiles.execute(
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
                directory.forget(projectId);
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
      review: (worktreeId, signal) => {
        const params = reviewParamsSchema.parse({ worktreeId });
        return forWorktree(
          (operationSignal) =>
            publishedReview.read(params.worktreeId, operationSignal),
          signal,
        );
      },
      publishReview: (worktreeId, value, signal) => {
        const params = reviewParamsSchema.parse({ worktreeId });
        const input = publishReviewSchema.parse(structuredClone(value));
        return forWorktree(
          (operationSignal) =>
            publishedReview.publish(params.worktreeId, input, operationSignal),
          signal,
        ).then((answer) => {
          live.publishWorktree(worktreeId, 'review');
          return answer;
        });
      },
      reviewSummary: (token, expires, signature) => {
        lanes.assertOpen();
        const summary = publishedReview.summary(token);
        if (
          summary === null ||
          !verifySummarySignature(
            summary.summarySecret,
            token,
            expires,
            signature,
          )
        )
          return null;
        return summary.summaryHtml;
      },
      listReviewedLayers: (worktreeId, signal) =>
        forWorktree(async (operationSignal) => {
          await worktrees.known(worktreeId, operationSignal);
          return { worktreeId, marks: reviewedLayers.list(worktreeId) };
        }, signal),
      setReviewedLayer: (worktreeId, value, signal) => {
        const input = setReviewedLayerRequestSchema.parse(value);
        return forWorktree(async (operationSignal) => {
          await worktrees.forWriting(worktreeId, operationSignal);
          reviewedLayers.set(worktreeId, {
            layerId: input.layerId,
            fingerprint: input.fingerprint,
            reviewedAt: options.now?.() ?? new Date().toISOString(),
          });
          return { worktreeId, marks: reviewedLayers.list(worktreeId) };
        }, signal).then((answer) => {
          live.publishWorktree(worktreeId, 'reviewed');
          return answer;
        });
      },
      removeReviewedLayer: (worktreeId, layerId, signal) =>
        forWorktree(async (operationSignal) => {
          await worktrees.forWriting(worktreeId, operationSignal);
          reviewedLayers.remove(worktreeId, layerId);
          return { worktreeId, marks: reviewedLayers.list(worktreeId) };
        }, signal).then((answer) => {
          live.publishWorktree(worktreeId, 'reviewed');
          return answer;
        }),
      liveUpdates: (send) => live.connect(send),
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
        try {
          deviceDirectory.flush();
        } catch {
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
