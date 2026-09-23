import type { ProjectFolder } from '../models/project-location.ts';
import type { ProjectFolderReader } from '../ports/project-folder-reader.ts';
import type { ProjectRepositoryReader } from '../ports/project-repository-reader.ts';

export class BrowseProjectFoldersService {
  private readonly folders: ProjectFolderReader;
  private readonly repositories: ProjectRepositoryReader;
  private readonly home: string;

  constructor(
    folders: ProjectFolderReader,
    repositories: ProjectRepositoryReader,
    home: string,
  ) {
    this.folders = folders;
    this.repositories = repositories;
    this.home = home;
  }

  async execute(
    path = this.home,
    signal?: AbortSignal,
  ): Promise<ProjectFolder> {
    const folder = await this.folders.read(path, signal);
    let repository = false;
    if (folder.gitMarker) {
      try {
        await this.repositories.inspect(folder.path, signal);
        signal?.throwIfAborted();
        repository = true;
      } catch (error) {
        signal?.throwIfAborted();
        if (!this.repositories.isUnavailable(error)) throw error;
      }
    }
    return {
      path: folder.path,
      parent: folder.parent,
      directories: folder.directories.map(({ name, path }) => ({ name, path })),
      repository,
      truncated: folder.truncated,
    };
  }
}
