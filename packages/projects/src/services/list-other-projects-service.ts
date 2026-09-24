import type {
  ListOtherProjectsInput,
  ListOtherProjectsResult,
} from '../models/list-other-projects.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class ListOtherProjectsService {
  private readonly inventory: InventoryStore;

  constructor(inventory: InventoryStore) {
    this.inventory = inventory;
  }

  execute(input: ListOtherProjectsInput): ListOtherProjectsResult {
    return {
      projects: this.inventory
        .read()
        .projects.filter(
          (project) => project.repositoryIdentity !== input.repositoryIdentity,
        ),
    };
  }
}
