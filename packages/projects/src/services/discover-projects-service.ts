import { basename, dirname, parse } from 'node:path';
import type { ProjectDiscovery } from '../models/project-location.ts';
import type {
  ProjectFolderContents,
  ProjectFolderReader,
} from '../ports/project-folder-reader.ts';
import type {
  DiscoveredProjectRepository,
  ProjectRepositoryReader,
} from '../ports/project-repository-reader.ts';
import type { ProjectStore } from '../ports/project-store.ts';

const skippedFolders = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'target',
]);

export class DiscoverProjectsService {
  private readonly folders: ProjectFolderReader;
  private readonly repositories: ProjectRepositoryReader;
  private readonly store: ProjectStore;
  private readonly home: string;
  private readonly isFolderUnavailable: (error: unknown) => boolean;

  constructor(
    folders: ProjectFolderReader,
    repositories: ProjectRepositoryReader,
    store: ProjectStore,
    home: string,
    isFolderUnavailable: (error: unknown) => boolean,
  ) {
    this.folders = folders;
    this.repositories = repositories;
    this.store = store;
    this.home = home;
    this.isFolderUnavailable = isFolderUnavailable;
  }

  async execute(signal?: AbortSignal): Promise<ProjectDiscovery> {
    const roots = new Set([this.home]);
    for (const project of this.store.read().projects) {
      const parent = dirname(dirname(project.commonDirectory));
      if (parent !== parse(parent).root) roots.add(parent);
    }
    const queue = [...roots].map((path) => ({ path, depth: 0 }));
    const visited = new Set<string>();
    const identities = new Set<string>();
    const result: ProjectDiscovery = { repositories: [], limited: false };
    for (let index = 0; index < queue.length; index++) {
      signal?.throwIfAborted();
      if (index >= 500 || result.repositories.length >= 50) {
        result.limited = true;
        break;
      }
      const next = queue[index];
      if (!next) break;
      let folder: ProjectFolderContents;
      try {
        folder = await this.folders.read(next.path, signal);
      } catch (error) {
        signal?.throwIfAborted();
        if (!this.isFolderUnavailable(error)) throw error;
        result.limited = true;
        continue;
      }
      if (visited.has(folder.path)) continue;
      visited.add(folder.path);
      result.limited ||= folder.truncated;
      const repository = await this.repository(folder, signal);
      if (repository) {
        if (!identities.has(repository.repositoryIdentity)) {
          identities.add(repository.repositoryIdentity);
          const path =
            repository.worktrees.find((entry) => entry.main && entry.available)
              ?.path ?? folder.path;
          result.repositories.push({ name: basename(path), path });
        }
        continue;
      }
      const children = folder.directories.filter(
        (entry) =>
          !entry.symbolicLink &&
          !entry.name.startsWith('.') &&
          !skippedFolders.has(entry.name),
      );
      if (next.depth >= 3) {
        result.limited ||= children.length > 0;
        continue;
      }
      for (const child of children) {
        if (queue.length >= 500) {
          result.limited = true;
          break;
        }
        queue.push({ path: child.path, depth: next.depth + 1 });
      }
    }
    result.repositories.sort(
      (a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path),
    );
    return result;
  }

  private async repository(
    folder: ProjectFolderContents,
    signal?: AbortSignal,
  ): Promise<DiscoveredProjectRepository | undefined> {
    if (!folder.gitMarker) return undefined;
    try {
      const { repository } = await this.repositories.inspect(
        folder.path,
        signal,
      );
      signal?.throwIfAborted();
      return repository;
    } catch (error) {
      signal?.throwIfAborted();
      if (this.repositories.isUnavailable(error)) return undefined;
      throw error;
    }
  }
}
