import { Effect } from 'effect';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class MarkProjectsUnavailableService {
  private readonly inventory: InventoryStore;

  constructor(inventory: InventoryStore) {
    this.inventory = inventory;
  }

  execute(): Effect.Effect<void, never> {
    return Effect.sync(() => {
      this.inventory.markAllUnavailable();
    });
  }
}
