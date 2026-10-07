import { Effect, Layer } from 'effect';
import type { WorktreeKey } from '@porcelain/kernel/models';
import type {
  CatalogEntry,
  CatalogObservation,
  CatalogSnapshot,
  ListedWorktree,
  ProjectKey,
} from '@porcelain/projects/models';
import { WorktreeCatalogStore } from '@porcelain/projects/ports';

export const inMemoryWorktreeCatalogStoreLayer = Layer.effect(
  WorktreeCatalogStore,
  Effect.sync(() => {
    let snapshot: CatalogSnapshot = { projects: [] };
    let entries = new Map<string, CatalogEntry>();
    return {
      find(input: WorktreeKey): CatalogEntry | undefined {
        return structuredClone(entries.get(input.worktreeId));
      },
      lastSeen(input: ProjectKey): ListedWorktree[] {
        return structuredClone(
          snapshot.projects.find(
            (project) => project.observation.id === input.projectId,
          )?.worktrees ?? [],
        );
      },
      listObservations(): CatalogObservation[] {
        return snapshot.projects.map((project) => ({
          ...project.observation,
        }));
      },
      save(input: CatalogSnapshot): void {
        snapshot = structuredClone(input);
        entries = new Map(
          snapshot.projects.flatMap((project) =>
            project.worktrees.map((worktree): [string, CatalogEntry] => [
              worktree.id,
              { worktree, observation: project.observation },
            ]),
          ),
        );
      },
    };
  }),
);
