import type { ListRegisteredProjectsResult } from '../models/list-registered-projects.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class ListRegisteredProjectsService {
  private readonly inventory: InventoryStore;

  constructor(inventory: InventoryStore) {
    this.inventory = inventory;
  }

  execute(): ListRegisteredProjectsResult {
    return this.inventory.read();
  }
}
