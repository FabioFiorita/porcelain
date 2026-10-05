import { Logger } from '../ports/logger.ts';
import { EventPublisher } from '../ports/event-publisher.ts';
import { LaneKeys } from '../runtime/lane-keys.ts';
import { Lanes } from '../runtime/lanes.ts';
import { WorktreeConsistencyProbe } from '../ports/worktree-consistency-probe.ts';
import {
  DirectoryReader,
  IgnoredEntriesReader,
  ListDirectoryOptions,
  FileReader,
  ReadFileAssetOptions,
  ReadPreviewAssetsOptions,
  FileWriter,
  EditFileOptions,
  WorktreePathsReader,
} from '@porcelain/files/ports';
import { Effect, Layer } from 'effect';
import {
  EditFileService,
  ListDirectoryService,
  ListWorktreePathsService,
  ReadFileAssetService,
  ReadPreviewAssetsService,
  ReadTextFileService,
} from '@porcelain/files/services';
import { gitDirectoryName, temporaryWriteName } from '@porcelain/kernel/rules';
import { FilesystemDirectoryReader } from '../adapters/files/filesystem-directory-reader.ts';
import { FilesystemFileWriter } from '../adapters/files/filesystem-file-writer.ts';
import { GitIgnoredEntriesReader } from '../adapters/files/git-ignored-entries-reader.ts';
import { GitWorktreePathsReader } from '../adapters/files/git-worktree-paths-reader.ts';
import { filesRoutes } from '../http/routes/files/files-api.ts';
import { CheckWorktreeUseCasePort } from '../ports/check-worktree-use-case-port.ts';
import { EditAnnouncementWriter } from '../ports/edit-announcement-writer.ts';
import { InvalidateReviewedMarksUseCasePort } from '../ports/invalidate-reviewed-marks-use-case-port.ts';
import { WorktreeAccess } from '../runtime/worktree-access.ts';
import { EditFileUseCase } from '../use-cases/files/edit-file.ts';
import { ListDirectoryUseCase } from '../use-cases/files/list-directory.ts';
import { ListWorktreePathsUseCase } from '../use-cases/files/list-worktree-paths.ts';
import { ReadFileAssetUseCase } from '../use-cases/files/read-file-asset.ts';
import { ReadPreviewAssetsUseCase } from '../use-cases/files/read-preview-assets.ts';
import { ReadTextFileUseCase } from '../use-cases/files/read-text-file.ts';
import { type ComposeContext } from './compose-context.ts';
import { type Shared } from './compose-shared.ts';

type FilesDependencies = {
  shared: Shared;
  checkWorktree: CheckWorktreeUseCasePort;
  invalidateReviewedMarks: InvalidateReviewedMarksUseCasePort;
  editAnnouncements: EditAnnouncementWriter;
};

export function composeFiles(
  context: ComposeContext,
  dependencies: FilesDependencies,
) {
  const { laneKeys, events, logger } = context;
  const { limits } = context.settings;
  const { worktreeAccess, fileReader } = dependencies.shared;
  const { lanes } = context;
  const ports = Layer.mergeAll(
    Layer.succeed(CheckWorktreeUseCasePort, dependencies.checkWorktree),
    Layer.succeed(
      WorktreeConsistencyProbe,
      dependencies.shared.confirmWorktree,
    ),
    Layer.succeed(Lanes, lanes),
    Layer.succeed(LaneKeys, laneKeys),
    Layer.succeed(
      DirectoryReader,
      new FilesystemDirectoryReader(worktreeAccess, {
        gitDirectory: gitDirectoryName(),
      }),
    ),
    Layer.succeed(
      IgnoredEntriesReader,
      new GitIgnoredEntriesReader(worktreeAccess, limits.git),
    ),
    Layer.succeed(ListDirectoryOptions, limits.files.listDirectory),
    Layer.succeed(ReadTextFileService, dependencies.shared.readTextFileService),
    Layer.succeed(FileReader, fileReader),
    Layer.succeed(ReadFileAssetOptions, limits.files.readFileAsset),
    Layer.succeed(ReadPreviewAssetsOptions, limits.files.readPreviewAssets),
    Layer.succeed(
      FileWriter,
      new FilesystemFileWriter(worktreeAccess, {
        ...limits.files.permissions,
        temporaryName: temporaryWriteName,
      }),
    ),
    Layer.succeed(EditFileOptions, limits.files.editFile),
    Layer.succeed(
      InvalidateReviewedMarksUseCasePort,
      dependencies.invalidateReviewedMarks,
    ),
    Layer.succeed(EventPublisher, events),
    Layer.succeed(EditAnnouncementWriter, dependencies.editAnnouncements),
    Layer.succeed(Logger, logger),
    Layer.succeed(
      WorktreePathsReader,
      new GitWorktreePathsReader(worktreeAccess, limits.git),
    ),
  );
  const services = Layer.mergeAll(
    WorktreeAccess.layer,
    ListDirectoryService.layer,
    ReadFileAssetService.layer,
    ReadPreviewAssetsService.layer,
    EditFileService.layer,
    ListWorktreePathsService.layer,
  ).pipe(Layer.provideMerge(ports));
  const operations = Layer.mergeAll(
    ListDirectoryUseCase.layer,
    ReadTextFileUseCase.layer,
    ReadFileAssetUseCase.layer,
    ReadPreviewAssetsUseCase.layer,
    EditFileUseCase.layer,
    ListWorktreePathsUseCase.layer,
  ).pipe(Layer.provideMerge(services));
  return Effect.gen(function* () {
    const useCases = {
      listDirectory: yield* ListDirectoryUseCase,
      readTextFile: yield* ReadTextFileUseCase,
      readFileAsset: yield* ReadFileAssetUseCase,
      readPreviewAssets: yield* ReadPreviewAssetsUseCase,
      editFile: yield* EditFileUseCase,
      listWorktreePaths: yield* ListWorktreePathsUseCase,
    };
    return filesRoutes(useCases, limits.http);
  }).pipe(Effect.provide(operations));
}
