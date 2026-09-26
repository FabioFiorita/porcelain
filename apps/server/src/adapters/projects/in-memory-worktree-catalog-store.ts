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
  private entries = new Map<string, CatalogEntry>();

  find(input: WorktreeKey): CatalogEntry | undefined {
    return structuredClone(this.entries.get(input.worktreeId));
  }

  lastSeen(input: ProjectKey): ListedWorktree[] {
    return structuredClone(
      this.snapshot.projects.find(
        (project) => project.observation.id === input.projectId,
      )?.worktrees ?? [],
    );
  }

  listObservations(): CatalogObservation[] {
    return this.snapshot.projects.map((project) => ({
      ...project.observation,
    }));
  }

  save(input: CatalogSnapshot): void {
    this.snapshot = structuredClone(input);
    this.entries = new Map(
      this.snapshot.projects.flatMap((project) =>
        project.worktrees.map((worktree): [string, CatalogEntry] => [
          worktree.id,
          { worktree, observation: project.observation },
        ]),
      ),
    );
  }
}
