import {
  CheckWorktreeService,
  EditFileService,
  ListDirectoryService,
  ListWorktreePathsService,
  ReadFileAssetService,
  ReadPreviewAssetsService,
  ReadTextFileService,
} from '@porcelain/files/services';
import type { ListedWorktree } from '@porcelain/projects/models';
import type { WorktreeAccess } from '@porcelain/kernel/ports';
import { DirectoryReaderAdapter } from '../adapters/files/directory-reader-adapter.ts';
import { FileReaderAdapter } from '../adapters/files/file-reader-adapter.ts';
import { FileWriterAdapter } from '../adapters/files/file-writer-adapter.ts';
import { IgnoredEntriesReaderAdapter } from '../adapters/files/ignored-entries-reader-adapter.ts';
import { WorktreePathsReaderAdapter } from '../adapters/files/worktree-paths-reader-adapter.ts';
import { EditFileController } from '../controllers/edit-file-controller.ts';
import { ListDirectoryController } from '../controllers/list-directory-controller.ts';
import { ListWorktreePathsController } from '../controllers/list-worktree-paths-controller.ts';
import { ReadFileAssetController } from '../controllers/read-file-asset-controller.ts';
import { ReadPreviewAssetsController } from '../controllers/read-preview-assets-controller.ts';
import { ReadTextFileController } from '../controllers/read-text-file-controller.ts';
import type { EventPublisher } from '../runtime/event-publisher.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';

export function composeFiles(deps: {
  lanes: Lanes;
  laneKeys: LaneKeys;
  events: EventPublisher;
  worktreeAccess: WorktreeAccess<ListedWorktree>;
}) {
  const { lanes, laneKeys, events, worktreeAccess } = deps;
  const checkWorktree = new CheckWorktreeService(worktreeAccess);
  const fileReader = new FileReaderAdapter(worktreeAccess);
  const readTextFileService = new ReadTextFileService(fileReader);
  return {
    fileReader,
    readTextFileService,
    listDirectoryController: new ListDirectoryController(
      checkWorktree,
      new ListDirectoryService(
        new DirectoryReaderAdapter(worktreeAccess),
        new IgnoredEntriesReaderAdapter(worktreeAccess),
      ),
      lanes,
      laneKeys,
    ),
    readTextFileController: new ReadTextFileController(
      checkWorktree,
      readTextFileService,
      lanes,
      laneKeys,
    ),
    readFileAssetController: new ReadFileAssetController(
      checkWorktree,
      new ReadFileAssetService(fileReader),
      lanes,
      laneKeys,
    ),
    readPreviewAssetsController: new ReadPreviewAssetsController(
      checkWorktree,
      new ReadPreviewAssetsService(fileReader),
      lanes,
      laneKeys,
    ),
    editFileController: new EditFileController(
      checkWorktree,
      new EditFileService(fileReader, new FileWriterAdapter(worktreeAccess)),
      lanes,
      laneKeys,
      events,
    ),
    listWorktreePathsController: new ListWorktreePathsController(
      checkWorktree,
      new ListWorktreePathsService(
        new WorktreePathsReaderAdapter(worktreeAccess),
      ),
      lanes,
      laneKeys,
    ),
  };
}
