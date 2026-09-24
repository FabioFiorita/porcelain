import type { InventoryStore } from '../ports/inventory-store.ts';

export class MarkProjectsUnavailableService {
  private readonly inventory: InventoryStore;

  constructor(inventory: InventoryStore) {
    this.inventory = inventory;
  }

  execute(): void {
    this.inventory.markAllUnavailable();
  }
}
