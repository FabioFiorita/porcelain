import type {
  Inventory,
  ProjectKey,
  RegisteredProject,
} from '@porcelain/projects/models';
import type { InventoryStore } from '@porcelain/projects/ports';

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

  find(input: ProjectKey): RegisteredProject | undefined {
    const project = this.projects.get(input.projectId);
    return project && { ...project };
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

  remove(input: ProjectKey): void {
    this.projects.delete(input.projectId);
  }
}
