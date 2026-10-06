import { BrowseProjectFoldersOptions } from '../ports/browse-project-folders-options.ts';
import { Effect, Context, Layer } from 'effect';
import { withoutGitDirectory } from '@porcelain/kernel/rules';
import { FolderNotFoundError } from '../errors/folder-not-found-error.ts';
import { FolderNotReadableError } from '../errors/folder-not-readable-error.ts';
import { UnsupportedFolderNameError } from '../errors/unsupported-folder-name-error.ts';
import {
  type BrowseProjectFoldersInput,
  type BrowseProjectFoldersResult,
} from '../models/browse-project-folders.ts';
import { ProjectFolderReader } from '../ports/project-folder-reader.ts';
import { ProjectRepositoryReader } from '../ports/project-repository-reader.ts';

export class BrowseProjectFoldersService extends Context.Service<
  BrowseProjectFoldersService,
  {
    readonly execute: (
      input: BrowseProjectFoldersInput,
    ) => Effect.Effect<
      BrowseProjectFoldersResult,
      FolderNotFoundError | FolderNotReadableError | UnsupportedFolderNameError
    >;
  }
>()('@porcelain/projects/BrowseProjectFoldersService') {
  static readonly layer = Layer.effect(
    BrowseProjectFoldersService,
    Effect.gen(function* () {
      const projectFolderReaderCapability = yield* ProjectFolderReader;
      const projectRepositoryReaderCapability = yield* ProjectRepositoryReader;
      const optionsCapability = yield* BrowseProjectFoldersOptions;

      return {
        execute: Effect.fn('BrowseProjectFoldersService.execute')(function* (
          input: BrowseProjectFoldersInput,
        ): Effect.fn.Return<
          BrowseProjectFoldersResult,
          | FolderNotFoundError
          | FolderNotReadableError
          | UnsupportedFolderNameError
        > {
          const read = yield* projectFolderReaderCapability.read({
            path: input.path ?? optionsCapability.home,
            maxEntries: optionsCapability.maxEntries,
          });
          if (read.kind === 'missing')
            return yield* Effect.fail(new FolderNotFoundError());
          if (read.kind === 'unreadable')
            return yield* Effect.fail(new FolderNotReadableError());
          if (read.kind === 'unsupported-name')
            return yield* Effect.fail(new UnsupportedFolderNameError());
          const folder = read.contents;
          const repository =
            folder.gitMarker &&
            (yield* projectRepositoryReaderCapability.find({
              path: folder.path,
            })) !== undefined;
          return {
            path: folder.path,
            parent: folder.parent,
            directories: withoutGitDirectory(folder.directories).map(
              ({ name, path }) => ({ name, path }),
            ),
            repository,
            truncated: folder.truncated,
          };
        }),
      };
    }),
  );
}
