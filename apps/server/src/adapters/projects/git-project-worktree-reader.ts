import type { DiscoveryResult, GitFactory } from '@porcelain/git/discovery';
import {
  corroborates,
  identity,
  isRepositoryUnavailable,
  readGitdirPointer,
  readHead,
} from '@porcelain/git/discovery';
import type {
  ListableProject,
  ListedWorktree,
  ProjectKey,
  WorktreeListing,
} from '@porcelain/projects/models';
import type {
  InventoryStore,
  WorktreeCatalogStore,
} from '@porcelain/projects/ports';
import type { LaunchLimit } from '../../runtime/launch-limit.ts';
import type { SharedReads } from '../../runtime/shared-reads.ts';

export type WorktreeLookup = {
  worktree: ListedWorktree | undefined;
  unlisted: boolean;
};

export type WorktreeDirectoryOptions = {
  git: GitFactory;
  inventoryStore: InventoryStore;
  sharedReads: Pick<SharedReads<WorktreeListing>, 'run'>;
  launchLimit: Pick<LaunchLimit, 'run'>;
  timeoutMs: number;
  worktreeId: (projectId: string, metadataIdentity: string) => string;
};

export class GitWorktreeCatalogStore implements WorktreeCatalogStore {
  private readonly entries = new Map<string, ListedWorktree>();
  private readonly options: WorktreeDirectoryOptions;

  constructor(options: WorktreeDirectoryOptions) {
    this.options = options;
  }

  list(input: ListableProject, signal?: AbortSignal): Promise<WorktreeListing> {
    return this.options.sharedReads.run(
      `worktrees\0${input.id}\0${input.commonDirectory}`,
      async (shared) => this.listNow(input, shared),
      signal,
    );
  }

  lastSeen(input: ProjectKey): ListedWorktree[] {
    return [...this.entries.values()].filter(
      (entry) => entry.projectId === input.projectId,
    );
  }

  remove(input: ProjectKey): void {
    for (const entry of this.lastSeen(input)) this.entries.delete(entry.id);
  }

  async find(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<WorktreeLookup> {
    const known = this.entries.get(worktreeId);
    const refreshed = known ? await this.reread(known) : undefined;
    if (refreshed) return { worktree: refreshed, unlisted: false };
    if (known) this.entries.delete(worktreeId);
    const listings = await Promise.all(
      this.options.inventoryStore
        .read()
        .projects.map((project) => this.list(project, signal)),
    );
    const found = this.entries.get(worktreeId);
    if (found) return { worktree: await this.reread(found), unlisted: false };
    return {
      worktree: undefined,
      unlisted: listings.some((listing) => listing.kind !== 'listed'),
    };
  }

  repositoryOf(worktreeId: string): string | undefined {
    return this.entries.get(worktreeId)?.repositoryIdentity;
  }

  private async listNow(
    project: ListableProject,
    signal?: AbortSignal,
  ): Promise<WorktreeListing> {
    let discovered: DiscoveryResult;
    let expiry: AbortSignal | undefined;
    try {
      discovered = await this.options.launchLimit.run(() => {
        expiry = AbortSignal.timeout(this.options.timeoutMs);
        const listing = signal ? AbortSignal.any([signal, expiry]) : expiry;
        return this.options
          .git(project.commonDirectory)
          .listWorktrees(listing, { commonDirectory: project.commonDirectory });
      }, signal);
    } catch (failure) {
      signal?.throwIfAborted();
      if (expiry?.aborted) return { kind: 'timed-out', projectId: project.id };
      if (!isRepositoryUnavailable(failure)) throw failure;
      return { kind: 'unavailable', projectId: project.id };
    }
    const { repository } = discovered;
    if (repository.repositoryIdentity !== project.repositoryIdentity)
      return { kind: 'moved', projectId: project.id };
    const worktrees: ListedWorktree[] = [];
    let unidentified = 0;
    for (const worktree of repository.worktrees) {
      if (!worktree.metadataIdentity) {
        unidentified += 1;
        continue;
      }
      worktrees.push({
        id: this.options.worktreeId(project.id, worktree.metadataIdentity),
        projectId: project.id,
        path: worktree.path,
        branch: worktree.branch ?? undefined,
        main: worktree.main,
        available: worktree.available,
        metadataIdentity: worktree.metadataIdentity,
        administrativeDirectory: worktree.administrativeDirectory,
        commonDirectory: repository.commonDirectory,
        repositoryIdentity: repository.repositoryIdentity,
      });
    }
    this.remove({ projectId: project.id });
    for (const worktree of worktrees) this.entries.set(worktree.id, worktree);
    return { kind: 'listed', projectId: project.id, worktrees, unidentified };
  }

  private async reread(
    entry: ListedWorktree,
  ): Promise<ListedWorktree | undefined> {
    let current: string;
    try {
      current = await identity(entry.administrativeDirectory);
    } catch {
      return undefined;
    }
    if (current !== entry.metadataIdentity) return undefined;
    const path = entry.main
      ? entry.path
      : await readGitdirPointer(entry.administrativeDirectory);
    if (!path) return undefined;
    const branch = await readHead(entry.administrativeDirectory);
    const refreshed: ListedWorktree = {
      ...entry,
      path,
      branch: branch ?? undefined,
      available: await corroborates(path, entry.administrativeDirectory),
    };
    this.entries.set(entry.id, refreshed);
    return refreshed;
  }
}
