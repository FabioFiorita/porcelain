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

  async execute(
    input: BrowseProjectFoldersInput,
    signal?: AbortSignal,
  ): Promise<BrowseProjectFoldersResult> {
    const read = await this.projectFolderReader.read(
      {
        path: input.path ?? this.options.home,
        maxEntries: this.options.maxEntries,
      },
      signal,
    );
    if (read.kind === 'missing') throw new FolderNotFoundError();
    if (read.kind === 'unreadable') throw new FolderNotReadableError();
    if (read.kind === 'unsupported-name')
      throw new UnsupportedFolderNameError();
    const folder = read.contents;
    const repository =
      folder.gitMarker &&
      (await this.projectRepositoryReader.find(
        { path: folder.path },
        signal,
      )) !== undefined;
    return {
      path: folder.path,
      parent: folder.parent,
      directories: withoutGitDirectory(folder.directories).map(
        ({ name, path }) => ({ name, path }),
      ),
      repository,
      truncated: folder.truncated,
    };
  }
}
