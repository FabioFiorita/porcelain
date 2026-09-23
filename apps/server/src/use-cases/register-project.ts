import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import type { GitFactory } from '@porcelain/git/interfaces/git-factory';
import type { RegisteredProject } from '../models/project.ts';
import { deriveProjectName } from '../models/project-name.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import type { WorktreeSource } from '../repositories/interfaces/worktree-source.ts';

export class RegisterProject {
  private readonly store: InventoryStore;
  private readonly git: GitFactory;
  private readonly directory: WorktreeSource;

  constructor(
    store: InventoryStore,
    git: GitFactory,
    directory: WorktreeSource,
  ) {
    this.store = store;
    this.git = git;
    this.directory = directory;
  }

  async execute(checkout: string, signal?: AbortSignal) {
    const { repository: discovered, issues } =
      await this.git(checkout).listWorktrees(signal);
    signal?.throwIfAborted();
    const paths = new Set(
      discovered.worktrees.map((worktree) => worktree.path),
    );
    const others = this.store
      .read()
      .projects.filter(
        (project) =>
          project.repositoryIdentity !== discovered.repositoryIdentity,
      );
    for (const project of others) {
      const listing = await this.directory.list(project, signal);
      if (listing.worktrees.some((worktree) => paths.has(worktree.path)))
        issues.push(
          ...listing.issues,
          ...(listing.failure
            ? [{ path: checkout, error: listing.failure }]
            : []),
        );
    }
    signal?.throwIfAborted();
    const previous = this.store
      .read()
      .projects.find(
        (project) =>
          project.repositoryIdentity === discovered.repositoryIdentity,
      );
    const name = previous?.namedByOwner
      ? previous.name
      : deriveProjectName(
          await this.git(checkout).readOriginUrl(signal),
          discovered.worktrees.find((worktree) => worktree.main)?.path ??
            dirname(discovered.commonDirectory),
        );
    signal?.throwIfAborted();
    const project: RegisteredProject = {
      id: previous?.id ?? randomUUID(),
      name,
      namedByOwner: previous?.namedByOwner ?? false,
      commonDirectory: discovered.commonDirectory,
      repositoryIdentity: discovered.repositoryIdentity,
      available: true,
    };
    this.store.save(project);
    const listing = await this.directory.list(project, signal);
    return {
      project: { ...project, worktrees: listing.worktrees },
      issues,
    };
  }
}
