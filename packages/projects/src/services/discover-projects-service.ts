import type { DiscoverProjectsOptions } from '../models/folder-operations.ts';
import type { ProjectDiscovery } from '../models/project-folder.ts';
import { discoveryRoots } from '../rules/discovery-roots.ts';
import { folderName } from '../rules/folder-name.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';
import type { ProjectFolderReader } from '../ports/project-folder-reader.ts';
import type { ProjectRepositoryReader } from '../ports/project-repository-reader.ts';

const REPOSITORY_LIMIT = 50;
const FOLDER_LIMIT = 500;
const DEPTH_LIMIT = 3;
const SKIPPED_FOLDERS = ['node_modules', 'vendor', 'dist', 'build', 'target'];

export class DiscoverProjectsService {
  private readonly inventoryStore: InventoryStore;
  private readonly projectFolderReader: ProjectFolderReader;
  private readonly projectRepositoryReader: ProjectRepositoryReader;
  private readonly options: DiscoverProjectsOptions;

  constructor(
    inventoryStore: InventoryStore,
    projectFolderReader: ProjectFolderReader,
    projectRepositoryReader: ProjectRepositoryReader,
    options: DiscoverProjectsOptions,
  ) {
    this.inventoryStore = inventoryStore;
    this.projectFolderReader = projectFolderReader;
    this.projectRepositoryReader = projectRepositoryReader;
    this.options = options;
  }

  async execute(signal?: AbortSignal): Promise<ProjectDiscovery> {
    const search = await this.projectFolderReader.search(
      {
        roots: discoveryRoots(
          this.options.home,
          this.inventoryStore.read().projects,
        ),
        maxDepth: DEPTH_LIMIT,
        maxFolders: FOLDER_LIMIT,
        skipHidden: true,
        skippedNames: SKIPPED_FOLDERS,
      },
      signal,
    );
    const discovery: ProjectDiscovery = {
      repositories: [],
      limited: search.limited,
    };
    const identities = new Set<string>();
    for (const candidate of search.candidates) {
      signal?.throwIfAborted();
      if (discovery.repositories.length >= REPOSITORY_LIMIT) {
        discovery.limited = true;
        break;
      }
      const repository = await this.projectRepositoryReader.find(
        candidate,
        signal,
      );
      if (!repository || identities.has(repository.repositoryIdentity))
        continue;
      identities.add(repository.repositoryIdentity);
      const path =
        repository.worktrees.find((entry) => entry.main && entry.available)
          ?.path ?? candidate;
      discovery.repositories.push({ name: folderName(path), path });
    }
    discovery.repositories.sort(
      (a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path),
    );
    return discovery;
  }
}
