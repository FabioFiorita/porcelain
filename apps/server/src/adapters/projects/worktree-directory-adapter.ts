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
  Worktree,
  WorktreeListing,
} from '@porcelain/projects/models';
import type {
  InventoryStore,
  ProjectWorktreeReader,
} from '@porcelain/projects/ports';
import type { LaunchLimit } from '../../runtime/launch-limit.ts';
import type { SharedReads } from '../../runtime/shared-reads.ts';

export type WorktreeLookup = {
  worktree: Worktree | undefined;
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

export class WorktreeDirectoryAdapter implements ProjectWorktreeReader {
  private readonly entries = new Map<string, Worktree>();
  private readonly options: WorktreeDirectoryOptions;

  constructor(options: WorktreeDirectoryOptions) {
    this.options = options;
  }

  list(
    project: ListableProject,
    signal?: AbortSignal,
  ): Promise<WorktreeListing> {
    return this.options.sharedReads.run(
      `worktrees\0${project.id}\0${project.commonDirectory}`,
      async (shared) => this.listNow(project, shared),
      signal,
    );
  }

  forget(projectId: string): void {
    for (const [id, entry] of this.entries)
      if (entry.projectId === projectId) this.entries.delete(id);
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
      unlisted: listings.some((listing) => listing.outcome !== 'listed'),
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
      if (expiry?.aborted) return this.unlisted(project.id, 'timed-out');
      if (!isRepositoryUnavailable(failure)) throw failure;
      return this.unlisted(project.id, 'unavailable');
    }
    const { repository } = discovered;
    if (repository.repositoryIdentity !== project.repositoryIdentity)
      return this.unlisted(project.id, 'moved');
    const worktrees: Worktree[] = [];
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
    this.forget(project.id);
    for (const worktree of worktrees) this.entries.set(worktree.id, worktree);
    return {
      projectId: project.id,
      outcome: 'listed',
      worktrees,
      unidentified,
    };
  }

  private unlisted(
    projectId: string,
    outcome: 'unavailable' | 'timed-out' | 'moved',
  ): WorktreeListing {
    return {
      projectId,
      outcome,
      lastSeen: [...this.entries.values()].filter(
        (entry) => entry.projectId === projectId,
      ),
    };
  }

  private async reread(entry: Worktree): Promise<Worktree | undefined> {
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
    const refreshed: Worktree = {
      ...entry,
      path,
      branch: branch ?? undefined,
      available: await corroborates(path, entry.administrativeDirectory),
    };
    this.entries.set(entry.id, refreshed);
    return refreshed;
  }
}
