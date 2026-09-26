import type {
  DiscoverProjectsInput,
  DiscoverProjectsOptions,
  DiscoverProjectsResult,
} from '../models/discover-projects.ts';
import type { ProjectFolderReader } from '../ports/project-folder-reader.ts';
import type { ProjectRepositoryReader } from '../ports/project-repository-reader.ts';
import { discoveryRoots } from '../rules/discovery-roots.ts';
import {
  discoveryLimited,
  nextDiscoveryFolder,
  startDiscoveryWalk,
  visitDiscoveryFolder,
} from '../rules/discovery-walk.ts';
import { folderName } from '../rules/folder-name.ts';

export class DiscoverProjectsService {
  private readonly projectFolderReader: ProjectFolderReader;
  private readonly projectRepositoryReader: ProjectRepositoryReader;
  private readonly options: DiscoverProjectsOptions;

  constructor(
    projectFolderReader: ProjectFolderReader,
    projectRepositoryReader: ProjectRepositoryReader,
    options: DiscoverProjectsOptions,
  ) {
    this.projectFolderReader = projectFolderReader;
    this.projectRepositoryReader = projectRepositoryReader;
    this.options = options;
  }

  async execute(
    input: DiscoverProjectsInput,
    signal?: AbortSignal,
  ): Promise<DiscoverProjectsResult> {
    const policy = {
      maxDepth: this.options.maxDepth,
      maxFolders: this.options.maxFolders,
      skipHidden: true,
      skippedNames: this.options.skippedNames,
    };
    let walk = startDiscoveryWalk(
      discoveryRoots(this.options.home, input.projects),
    );
    for (
      let folder = nextDiscoveryFolder(walk, policy);
      folder !== undefined;
      folder = nextDiscoveryFolder(walk, policy)
    ) {
      const read = await this.projectFolderReader.read(
        { path: folder.path, maxEntries: this.options.maxEntries },
        signal,
      );
      walk = visitDiscoveryFolder(walk, folder, read, policy);
    }
    const discovery: DiscoverProjectsResult = {
      repositories: [],
      limited: discoveryLimited(walk, policy),
    };
    const identities = new Set<string>();
    for (const candidate of walk.candidates) {
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
