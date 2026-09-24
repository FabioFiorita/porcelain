import type { Inventory, RegisteredProject } from '../../src/models/project.ts';
import type { InventoryStore } from '../../src/ports/inventory-store.ts';

export class InMemoryInventoryStore implements InventoryStore {
  private projects: Map<string, RegisteredProject>;

  constructor(projects: RegisteredProject[] = []) {
    this.projects = new Map(
      projects.map((project) => [project.id, { ...project }]),
    );
  }

  read(): Inventory {
    return {
      projects: [...this.projects.values()]
        .map((project) => ({ ...project }))
        .sort((a, b) => a.position - b.position),
    };
  }

  save(input: RegisteredProject): void {
    this.projects.set(input.id, { ...input });
  }

  markAllUnavailable(): void {
    this.projects = new Map(
      [...this.projects].map(([id, project]) => [
        id,
        { ...project, available: false },
      ]),
    );
  }

  remove(projectId: string): void {
    this.projects.delete(projectId);
  }
}
