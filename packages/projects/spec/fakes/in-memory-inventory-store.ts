import { Effect } from 'effect';
import type {
  Inventory,
  ProjectKey,
  RegisteredProject,
} from '../../src/models/project.ts';
import type { InventoryStore } from '../../src/ports/inventory-store.ts';

export class InMemoryInventoryStore implements InventoryStore {
  private projects: Map<string, RegisteredProject>;

  constructor(projects: RegisteredProject[] = []) {
    this.projects = new Map(
      projects.map((project) => [project.id, { ...project }]),
    );
  }

  read(): Effect.Effect<Inventory> {
    return Effect.sync(() => {
      return {
        projects: [...this.projects.values()]
          .map((project) => ({ ...project }))
          .sort((a, b) => a.position - b.position),
      };
    });
  }

  find(input: ProjectKey): Effect.Effect<RegisteredProject | undefined> {
    return Effect.sync(() => {
      const project = this.projects.get(input.projectId);
      return project && { ...project };
    });
  }

  save(input: RegisteredProject): Effect.Effect<void> {
    return Effect.sync(() => {
      this.projects.set(input.id, { ...input });
    });
  }

  markAllUnavailable(): Effect.Effect<void> {
    return Effect.sync(() => {
      this.projects = new Map(
        [...this.projects].map(([id, project]) => [
          id,
          { ...project, available: false },
        ]),
      );
    });
  }

  remove(input: ProjectKey): Effect.Effect<void> {
    return Effect.sync(() => {
      this.projects.delete(input.projectId);
    });
  }
}
