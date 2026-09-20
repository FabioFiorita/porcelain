import { basename, dirname, parse } from 'node:path';
import { isRepositoryUnavailable } from '@porcelain/git/errors/is-repository-unavailable';
import type { GitFactory } from '@porcelain/git/interfaces/git-factory';
import { FileInspectionError } from '../filesystem/errors/file-inspection-error.ts';
import type {
  FolderContents,
  ProjectFolders,
} from '../filesystem/interfaces/project-folders.ts';
import type {
  ProjectDiscovery,
  ProjectFolder,
} from '../models/project-location.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';

const skippedFolders = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'target',
]);

export class FindProjects {
  private readonly folders: ProjectFolders;
  private readonly git: GitFactory;
  private readonly inventory: InventoryStore;
  private readonly home: string;

  constructor(
    folders: ProjectFolders,
    git: GitFactory,
    inventory: InventoryStore,
    home: string,
  ) {
    this.folders = folders;
    this.git = git;
    this.inventory = inventory;
    this.home = home;
  }

  private async repository(folder: FolderContents, signal?: AbortSignal) {
    if (!folder.gitMarker) return null;
    try {
      const { repository } = await this.git(folder.path).listWorktrees(signal);
      signal?.throwIfAborted();
      return repository;
    } catch (error) {
      signal?.throwIfAborted();
      if (isRepositoryUnavailable(error)) return null;
      throw error;
    }
  }

  async browse(path = this.home, signal?: AbortSignal): Promise<ProjectFolder> {
    const folder = await this.folders.read(path, signal);
    const repository = await this.repository(folder, signal);
    return {
      path: folder.path,
      parent: folder.parent,
      directories: folder.directories.map(({ name, path }) => ({ name, path })),
      repository: repository !== null,
      truncated: folder.truncated,
    };
  }

  async discover(signal?: AbortSignal): Promise<ProjectDiscovery> {
    const roots = new Set([this.home]);
    // Registered repositories suggest where to look. The common directory is
    // inside the repository, so its grandparent is the folder that holds it.
    for (const project of this.inventory.read().projects) {
      const parent = dirname(dirname(project.commonDirectory));
      if (parent !== parse(parent).root) roots.add(parent);
    }
    const queue = [...roots].map((path) => ({ path, depth: 0 }));
    const visited = new Set<string>();
    const identities = new Set<string>();
    const result: ProjectDiscovery = { repositories: [], limited: false };
    // Discovery is a nearby-repository suggestion, not an unbounded disk scan.
    for (let index = 0; index < queue.length; index++) {
      signal?.throwIfAborted();
      if (index >= 500 || result.repositories.length >= 50) {
        result.limited = true;
        break;
      }
      const next = queue[index];
      if (!next) break;
      let folder: FolderContents;
      try {
        folder = await this.folders.read(next.path, signal);
      } catch (error) {
        signal?.throwIfAborted();
        if (
          error instanceof FileInspectionError &&
          ['PATH_NOT_FOUND', 'PATH_NOT_READABLE', 'UNSUPPORTED_PATH'].includes(
            error.code,
          )
        ) {
          result.limited = true;
          continue;
        }
        throw error;
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
}
