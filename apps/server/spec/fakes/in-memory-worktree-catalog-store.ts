import type { WorktreeKey } from '@porcelain/kernel/models';
import type {
  CatalogEntry,
  CatalogObservation,
  CatalogSnapshot,
  ListedWorktree,
  ProjectKey,
} from '@porcelain/projects/models';
import type { WorktreeCatalogStore } from '@porcelain/projects/ports';

export class InMemoryWorktreeCatalogStore implements WorktreeCatalogStore {
  private snapshot: CatalogSnapshot = { projects: [] };

  find(input: WorktreeKey): CatalogEntry | undefined {
    return this.entries().find(
      (entry) => entry.worktree.id === input.worktreeId,
    );
  }

  lastSeen(input: ProjectKey): ListedWorktree[] {
    return this.entries()
      .filter((entry) => entry.observation.id === input.projectId)
      .map((entry) => entry.worktree);
  }

  observations(): CatalogObservation[] {
    return this.snapshot.projects.map((project) => ({
      ...project.observation,
    }));
  }

  save(input: CatalogSnapshot): void {
    this.snapshot = structuredClone(input);
  }

  private entries(): CatalogEntry[] {
    return structuredClone(this.snapshot).projects.flatMap((project) =>
      project.worktrees.map((worktree) => ({
        worktree,
        observation: project.observation,
      })),
    );
  }
}
