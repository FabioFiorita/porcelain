import type {
  DiscoverProjectsOptions,
  DiscoverProjectsResult,
} from '../models/discover-projects.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';
import type { ProjectFolderReader } from '../ports/project-folder-reader.ts';
import type { ProjectRepositoryReader } from '../ports/project-repository-reader.ts';
import { discoveryRoots } from '../rules/discovery-roots.ts';
import { folderName } from '../rules/folder-name.ts';

export class DiscoverProjectsService {
  private readonly inventory: InventoryStore;
  private readonly projectFolderReader: ProjectFolderReader;
  private readonly projectRepositoryReader: ProjectRepositoryReader;
  private readonly options: DiscoverProjectsOptions;

  constructor(
    inventory: InventoryStore,
    projectFolderReader: ProjectFolderReader,
    projectRepositoryReader: ProjectRepositoryReader,
    options: DiscoverProjectsOptions,
  ) {
    this.inventory = inventory;
    this.projectFolderReader = projectFolderReader;
    this.projectRepositoryReader = projectRepositoryReader;
    this.options = options;
  }

  async execute(signal?: AbortSignal): Promise<DiscoverProjectsResult> {
    const search = await this.projectFolderReader.search(
      {
        roots: discoveryRoots(
          this.options.home,
          this.inventory.read().projects,
        ),
        maxDepth: this.options.maxDepth,
        maxFolders: this.options.maxFolders,
        maxEntries: this.options.maxEntries,
        skipHidden: true,
        skippedNames: this.options.skippedNames,
      },
      signal,
    );
    const discovery: DiscoverProjectsResult = {
      repositories: [],
      limited: search.limited,
    };
    const identities = new Set<string>();
    for (const candidate of search.candidates) {
      if (discovery.repositories.length >= this.options.maxRepositories) {
        discovery.limited = true;
        break;
      }
      const repository = await this.projectRepositoryReader.find(
        { path: candidate },
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
