import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { deriveProjectName } from '../models/project-name.ts';
import type { RegisteredProject } from '../models/project.ts';
import type { ProjectRepositoryReader } from '../ports/project-repository-reader.ts';
import type { ProjectStore } from '../ports/project-store.ts';
import type {
  ProjectWorktree,
  ProjectWorktreeReader,
} from '../ports/project-worktree-reader.ts';

export class RegisterProjectService {
  private readonly store: ProjectStore;
  private readonly repositories: ProjectRepositoryReader;
  private readonly worktrees: ProjectWorktreeReader;

  constructor(
    store: ProjectStore,
    repositories: ProjectRepositoryReader,
    worktrees: ProjectWorktreeReader,
  ) {
    this.store = store;
    this.repositories = repositories;
    this.worktrees = worktrees;
  }

  async execute(
    checkout: string,
    signal?: AbortSignal,
  ): Promise<{
    project: RegisteredProject & { worktrees: ProjectWorktree[] };
    issues: { path: string; error: unknown }[];
  }> {
    const { repository: discovered, issues } = await this.repositories.inspect(
      checkout,
      signal,
    );
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
      const listing = await this.worktrees.list(project, signal);
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
          await this.repositories.readOriginUrl(checkout, signal),
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
    const listing = await this.worktrees.list(project, signal);
    return {
      project: { ...project, worktrees: listing.worktrees },
      issues,
    };
  }
}
