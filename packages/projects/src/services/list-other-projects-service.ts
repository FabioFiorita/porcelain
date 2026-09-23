import type { RegisteredProject } from '../models/project.ts';
import type { ListOtherProjectsInput } from '../models/project-operations.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class ListOtherProjectsService {
  private readonly inventoryStore: InventoryStore;

  constructor(inventoryStore: InventoryStore) {
    this.inventoryStore = inventoryStore;
  }

  execute(input: ListOtherProjectsInput): RegisteredProject[] {
    return this.inventoryStore
      .read()
      .projects.filter(
        (project) => project.repositoryIdentity !== input.repositoryIdentity,
      );
  }
}
