import { FolderNotFoundError } from '../errors/folder-not-found-error.ts';
import { FolderNotReadableError } from '../errors/folder-not-readable-error.ts';
import { UnsupportedFolderNameError } from '../errors/unsupported-folder-name-error.ts';
import type {
  BrowseProjectFoldersInput,
  BrowseProjectFoldersOptions,
} from '../models/folder-operations.ts';
import type { ProjectFolder } from '../models/project-folder.ts';
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
  ): Promise<ProjectFolder> {
    const read = await this.projectFolderReader.read(
      input.path ?? this.options.home,
      signal,
    );
    if (read.outcome === 'missing') throw new FolderNotFoundError();
    if (read.outcome === 'unreadable') throw new FolderNotReadableError();
    if (read.outcome === 'unsupported-name')
      throw new UnsupportedFolderNameError();
    const folder = read.contents;
    const repository =
      folder.gitMarker &&
      (await this.projectRepositoryReader.find(folder.path, signal)) !==
        undefined;
    signal?.throwIfAborted();
    return {
      path: folder.path,
      parent: folder.parent,
      directories: folder.directories.map(({ name, path }) => ({ name, path })),
      repository,
      truncated: folder.truncated,
    };
  }
}
