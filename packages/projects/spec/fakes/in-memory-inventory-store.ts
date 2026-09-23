import type { Inventory, RegisteredProject } from '@porcelain/projects/models';
import type { InventoryStore } from '@porcelain/projects/ports';

export class InMemoryInventoryStore implements InventoryStore {
  private readonly environmentId: string;
  private projects: RegisteredProject[];

  constructor(environmentId: string, projects: RegisteredProject[] = []) {
    this.environmentId = environmentId;
    this.projects = projects.map((project) => ({ ...project }));
  }

  read(): Inventory {
    return {
      environmentId: this.environmentId,
      projects: this.projects.map((project) => ({ ...project })),
    };
  }

  save(project: RegisteredProject): void {
    const index = this.projects.findIndex((entry) => entry.id === project.id);
    if (index === -1) this.projects.push({ ...project });
    else this.projects[index] = { ...project };
  }

  markAllUnavailable(): void {
    this.projects = this.projects.map((project) => ({
      ...project,
      available: false,
    }));
  }

  remove(projectId: string): void {
    this.projects = this.projects.filter((project) => project.id !== projectId);
  }
}
