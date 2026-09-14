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
import { InspectionGit } from '@porcelain/git/inspection-git';
import type { CommitReaderFactory } from '@porcelain/git/interfaces/commit-reader';
import type { GitActionWriterFactory } from '@porcelain/git/interfaces/git-action-writer';
import type { GitFactory } from '@porcelain/git/interfaces/git-factory';
import type { InspectionFactory } from '@porcelain/git/interfaces/inspection-factory';
import { readTreePaths } from '@porcelain/git/tree-paths';
import { CliCommitGenerator } from './agents/cli-commit-generator.ts';
import type { CommitGenerator } from './agents/interfaces/commit-generator.ts';
import type { Application } from './application.ts';
import { applicationSettingsSchema } from './config/application-settings.ts';
import { openDatabase } from './db/connection.ts';
import { NodeFileReader } from './filesystem/file-reader.ts';
import { NodeFileTree } from './filesystem/file-tree.ts';
import { NodeFileWriter } from './filesystem/file-writer.ts';
import type { FileReader } from './filesystem/interfaces/file-reader.ts';
import type { FileWriter } from './filesystem/interfaces/file-writer.ts';
import { GitActionCoordinator } from './lifecycle/git-action-coordinator.ts';
import { OperationRunner } from './lifecycle/operation-runner.ts';
import { ArtifactRepository } from './repositories/artifact-repository.ts';
import { CommentRepository } from './repositories/comment-repository.ts';
import { CommitReviewLayerRepository } from './repositories/commit-review-layer-repository.ts';
import { FilePreferenceRepository } from './repositories/file-preference-repository.ts';
import { GitActionRepository } from './repositories/git-action-repository.ts';
import { InventoryRepository } from './repositories/inventory-repository.ts';
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
import { GetArtifact } from './use-cases/get-artifact.ts';
import { GetCommitReviewLayers } from './use-cases/get-commit-review-layers.ts';
import { InspectCommitChanges } from './use-cases/inspect-commit-changes.ts';
import { ListArtifacts } from './use-cases/list-artifacts.ts';
import { ListCommits } from './use-cases/list-commits.ts';
import { ListDirectory } from './use-cases/list-directory.ts';
import { ListFilePreferences } from './use-cases/list-file-preferences.ts';
import { ListFileTree } from './use-cases/list-file-tree.ts';
import { ListReviewedFiles } from './use-cases/list-reviewed-files.ts';
import { PrepareGitAction } from './use-cases/prepare-git-action.ts';
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
import { SetFilePreference } from './use-cases/set-file-preference.ts';
import { SetReviewedFile } from './use-cases/set-reviewed-file.ts';
import { UploadArtifact } from './use-cases/upload-artifact.ts';

export async function openApplication(options: {
  dataDirectory: string;
  git?: GitFactory;
  actionGit?: GitActionWriterFactory;
  commitGit?: CommitReaderFactory;
  inspectionGit?: InspectionFactory;
  files?: FileReader;
  commitGenerator?: CommitGenerator;
  fileWriter?: FileWriter;
  now?: () => string;
  signal?: AbortSignal;
  operationTimeoutMs?: number;
}): Promise<Application> {
  const { operationTimeoutMs } = applicationSettingsSchema.parse(options);
  options.signal?.throwIfAborted();
  const database = openDatabase(options.dataDirectory);
  const operations = new OperationRunner(
    () => database.close(),
    operationTimeoutMs,
  );
  const drafting = new OperationRunner(() => {}, 120_000);
  try {
    const layers = new ReviewLayerRepository(database.db);
    const replaceLayers = new ReplaceReviewLayers(layers);
    const store = new InventoryRepository(database.db);
    const removeProject = new RemoveProject(
      new ProjectRemovalRepository(database.db),
    );
    const actionStore = new GitActionRepository(database.db);
    actionStore.recover();
    const actionGit =
      options.actionGit ??
      ((checkout, identity, repositoryIdentity) =>
        new ActionGit(checkout, identity, repositoryIdentity));

    const preferences = new FilePreferenceRepository(database.db);
    const listPreferences = new ListFilePreferences(store, preferences);
    const setPreference = new SetFilePreference(store, preferences);
    const artifacts = new ArtifactRepository(database.db);
    const uploadArtifact = new UploadArtifact(artifacts, store);
    const listArtifacts = new ListArtifacts(artifacts, store);
    const getArtifact = new GetArtifact(artifacts, store);
    const deleteArtifact = new DeleteArtifact(artifacts, store);
    const git = options.git ?? ((checkout: string) => new Git(checkout));
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
      options.inspectionGit ??
      ((checkout: string, identity: string, repositoryIdentity: string) =>
        new InspectionGit(checkout, identity, repositoryIdentity));
    const status = new ReadWorktreeStatus(store, inspection);
    const diff = new ReadWorktreeDiff(store, inspection);
    const evidence = new ReadWorktreeEvidence(store, inspection, git, files);
    const actions = new GitActionCoordinator(
      operations,
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
    await operations.run((signal) => refresh.execute(signal), options.signal);
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
    );
    return {
      reviewSummary: (worktreeId, signal) =>
        operations.run(
          (ownedSignal) => summary.execute(worktreeId, ownedSignal),
          signal,
        ),
      commitModels: (signal) =>
        drafting.run(
          (operationSignal) => generator.models(operationSignal),
          signal,
        ),
      draftCommits: async (scope, input, signal) => {
        scope = structuredClone(scope);
        input = structuredClone(input);
        const captured = await operations.run(
          (operationSignal) =>
            commitDrafts.capture(scope, input, operationSignal),
          signal,
        );
        const result = await drafting.runOwned(
          (operationSignal) =>
            commitDrafts.generate(captured, input, operationSignal),
          120_000,
          signal,
        );
        await operations.run(
          (operationSignal) =>
            commitDrafts.verify(scope, captured.fingerprint, operationSignal),
          signal,
        );
        return result;
      },
      prepareFetch: (scope, input, signal) =>
        actions.prepareAction(scope, { ...input, action: 'fetch' }, signal),
      executeFetch: (scope, input, signal) =>
        actions.submit(
          scope,
          'fetch',
          input.requestId,
          input.preparationId,
          signal,
        ),
      preparePull: (scope, input, signal) =>
        actions.prepareAction(scope, { ...input, action: 'pull' }, signal),
      executePull: (scope, input, signal) =>
        actions.submit(
          scope,
          'pull',
          input.requestId,
          input.preparationId,
          signal,
        ),
      preparePush: (scope, input, signal) =>
        actions.prepareAction(scope, { ...input, action: 'push' }, signal),
      executePush: (scope, input, signal) =>
        actions.submit(
          scope,
          'push',
          input.requestId,
          input.preparationId,
          signal,
        ),
      prepareCommit: (scope, input, signal) =>
        actions.prepareAction(scope, { ...input, action: 'commit' }, signal),
      executeCommit: (scope, input, signal) =>
        actions.submit(
          scope,
          'commit',
          input.requestId,
          input.preparationId,
          signal,
        ),
      prepareStashCreate: (scope, input, signal) =>
        actions.prepareAction(
          scope,
          { ...input, action: 'stash-create' },
          signal,
        ),
      executeStashCreate: (scope, input, signal) =>
        actions.submit(
          scope,
          'stash-create',
          input.requestId,
          input.preparationId,
          signal,
        ),
      prepareStashApply: (scope, input, signal) =>
        actions.prepareAction(
          scope,
          { ...input, action: 'stash-apply' },
          signal,
        ),
      executeStashApply: (scope, input, signal) =>
        actions.submit(
          scope,
          'stash-apply',
          input.requestId,
          input.preparationId,
          signal,
        ),
      prepareStashPop: (scope, input, signal) =>
        actions.prepareAction(scope, { ...input, action: 'stash-pop' }, signal),
      executeStashPop: (scope, input, signal) =>
        actions.submit(
          scope,
          'stash-pop',
          input.requestId,
          input.preparationId,
          signal,
        ),
      gitActionReceipt: (requestId) => actions.receipt(requestId),
      gitStatus: (worktreeId, signal) =>
        operations.run(
          (operationSignal) => status.execute(worktreeId, operationSignal),
          signal,
        ),
      gitDiff: (worktreeId, expectedStatusToken, selection, signal) => {
        const submitted = {
          scope: selection.scope,
          oldPath: selection.oldPath,
          newPath: selection.newPath,
        };
        return operations.run(
          (operationSignal) =>
            diff.execute(
              worktreeId,
              expectedStatusToken,
              submitted,
              operationSignal,
            ),
          signal,
        );
      },
      reviewEvidence: (worktreeId, signal) =>
        operations.run(
          (operationSignal) => evidence.execute(worktreeId, operationSignal),
          signal,
        ),
      listReviewedFiles: (worktreeId, signal) =>
        operations.run(
          async () => listReviewedFiles.execute(worktreeId),
          signal,
        ),
      setReviewedFile: (worktreeId, input, signal) => {
        const submitted = { ...input };
        return operations.run(
          (operationSignal) =>
            setReviewedFile.execute(worktreeId, submitted, operationSignal),
          signal,
        );
      },
      removeReviewedFile: (worktreeId, path, signal) =>
        operations.run(
          async () => removeReviewedFile.execute(worktreeId, path),
          signal,
        ),
      fileTree: (worktreeId, signal) =>
        operations.run(
          (operationSignal) => fileTree.execute(worktreeId, operationSignal),
          signal,
        ),
      editFile: (worktreeId, command, signal) => {
        const submitted = { ...command };
        return operations.runOwned(
          (operationSignal) =>
            editFile.execute(worktreeId, submitted, operationSignal),
          operationTimeoutMs,
          signal,
        );
      },
      listDirectory: (id: string, path: string, signal?: AbortSignal) =>
        operations.run(
          (operationSignal) => list.execute(id, path, operationSignal),
          signal,
        ),
      readTextFile: (id: string, path: string, signal?: AbortSignal) =>
        operations.run(
          (operationSignal) => read.execute(id, path, operationSignal),
          signal,
        ),
      removeProject: (projectId, signal) =>
        operations.run(async () => {
          actions.assertProjectRemovable(projectId);
          return removeProject.execute(projectId);
        }, signal),
      inventory: () => {
        operations.assertOpen();
        return store.read();
      },
      register: (checkout: string, signal?: AbortSignal) =>
        operations.run((operationSignal) => {
          return register.execute(checkout, operationSignal);
        }, signal),
      refresh: (signal?: AbortSignal) =>
        operations.run((operationSignal) => {
          return refresh.execute(operationSignal);
        }, signal),
      listCommits: (worktreeId, request, signal) => {
        const submitted = { ...request };
        return operations.run(
          (operationSignal) =>
            listCommits.execute(worktreeId, submitted, operationSignal),
          signal,
        );
      },
      inspectCommitChanges: (worktreeId, request, signal) => {
        const submitted = { ...request };
        return operations.run(
          (operationSignal) =>
            inspectCommitChanges.execute(
              worktreeId,
              submitted,
              operationSignal,
            ),
          signal,
        );
      },
      listFilePreferences: (projectId, signal) =>
        operations.run(async () => listPreferences.execute(projectId), signal),
      setFilePreference: (projectId, change, signal) => {
        const intent = {
          path: change.path,
          flag: change.flag,
          value: change.value,
        };
        return operations.run(
          async () => setPreference.execute(projectId, intent),
          signal,
        );
      },
      comments: async (command, signal) => {
        const snapshot = structuredClone(command);
        return operations.run(async () => comments.execute(snapshot), signal);
      },
      commitReviewLayers: (projectId, commitOid, signal) => {
        const params = commitReviewLayerParamsSchema.parse({
          projectId,
          oid: commitOid,
        });
        return operations.run(
          async () => getCommitLayers.execute(params.projectId, params.oid),
          signal,
        );
      },
      associateCommitReviewLayers: (projectId, commitOid, request, signal) => {
        const params = commitReviewLayerParamsSchema.parse({
          projectId,
          oid: commitOid,
        });
        const input = associateCommitReviewLayersSchema.parse(request);
        return operations.run(
          async (operationSignal) =>
            associateLayers.execute(
              params.projectId,
              params.oid,
              input,
              operationSignal,
            ),
          signal,
        );
      },
      reviewLayers: (worktreeId) => {
        operations.assertOpen();
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
        return operations.run(async () =>
          replaceLayers.execute(
            params.worktreeId,
            input.expectedRevision,
            input.layers,
          ),
        );
      },
      uploadArtifact: (worktreeId, input, signal) => {
        const submitted = { name: input.name, content: input.content };
        return operations.run(
          async () => uploadArtifact.execute(worktreeId, submitted),
          signal,
        );
      },
      listArtifacts: (worktreeId, signal) =>
        operations.run(async () => listArtifacts.execute(worktreeId), signal),
      getArtifact: (worktreeId, artifactId, signal) =>
        operations.run(
          async () => getArtifact.execute(worktreeId, artifactId),
          signal,
        ),
      deleteArtifact: (worktreeId, artifactId, signal) =>
        operations.run(
          async () => deleteArtifact.execute(worktreeId, artifactId),
          signal,
        ),
      close: async () => {
        await drafting.close();
        await operations.close();
      },
    };
  } catch (error) {
    await operations.close();
    throw error;
  }
}
