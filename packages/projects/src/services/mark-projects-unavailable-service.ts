import type { InventoryStore } from '../ports/inventory-store.ts';

export class MarkProjectsUnavailableService {
  private readonly inventoryStore: InventoryStore;

  constructor(inventoryStore: InventoryStore) {
    this.inventoryStore = inventoryStore;
  }

  execute(): void {
    this.inventoryStore.markAllUnavailable();
  }
}
