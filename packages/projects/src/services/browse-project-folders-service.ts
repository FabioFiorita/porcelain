import { Effect } from 'effect';
import { withoutGitDirectory } from '@porcelain/kernel/rules';
import { FolderNotFoundError } from '../errors/folder-not-found-error.ts';
import { FolderNotReadableError } from '../errors/folder-not-readable-error.ts';
import { UnsupportedFolderNameError } from '../errors/unsupported-folder-name-error.ts';
import type {
  BrowseProjectFoldersInput,
  BrowseProjectFoldersOptions,
  BrowseProjectFoldersResult,
} from '../models/browse-project-folders.ts';
import type { ProjectFolderReader } from '../ports/project-folder-reader.ts';
import type { ProjectRepositoryReader } from '../ports/project-repository-reader.ts';

export class BrowseProjectFoldersService {
  private readonly projectFolderReader: ProjectFolderReader;
  private readonly projectRepositoryReader: ProjectRepositoryReader;
  private readonly options: BrowseProjectFoldersOptions;

  constructor(
    projectFolderReader: ProjectFolderReader,
    projectRepositoryReader: ProjectRepositoryReader,
    options: BrowseProjectFoldersOptions,
  ) {
    this.projectFolderReader = projectFolderReader;
    this.projectRepositoryReader = projectRepositoryReader;
    this.options = options;
  }

  execute(
    input: BrowseProjectFoldersInput,
  ): Effect.Effect<
    BrowseProjectFoldersResult,
    FolderNotFoundError | FolderNotReadableError | UnsupportedFolderNameError
  > {
    return Effect.gen({ self: this }, function* () {
      const read = yield* this.projectFolderReader.read({
        path: input.path ?? this.options.home,
        maxEntries: this.options.maxEntries,
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
        (yield* this.projectRepositoryReader.find({ path: folder.path })) !==
          undefined;
      return {
        path: folder.path,
        parent: folder.parent,
        directories: withoutGitDirectory(folder.directories).map(
          ({ name, path }) => ({ name, path }),
        ),
        repository,
        truncated: folder.truncated,
      };
    });
  }
}
