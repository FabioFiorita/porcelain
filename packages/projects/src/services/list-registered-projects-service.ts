import type { Inventory } from '../models/project.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class ListRegisteredProjectsService {
  private readonly inventoryStore: InventoryStore;

  constructor(inventoryStore: InventoryStore) {
    this.inventoryStore = inventoryStore;
  }

  execute(): Inventory {
    return this.inventoryStore.read();
  }
}
